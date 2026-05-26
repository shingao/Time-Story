import type { CombatContext } from "@core/combat/effects/effect-handler.ts";
import {
	applyBuff,
	applyStatus,
	type Combatant,
	type Enemy,
	type EnemyAiState,
	gainBlock,
	type Intent,
	isAlive,
} from "@core/combat/entity.ts";
import type { Rng } from "@core/rng/rng.ts";
import type { EnemyDefinition, IntentCondition, IntentPattern } from "./enemy-types.ts";

// ---------------------------------------------------------------------------
// Intent rolling
// ---------------------------------------------------------------------------

/**
 * Selects and returns the next Intent for `enemy` based on `def`'s move table,
 * conditions, AiRules, and the current combat context.
 *
 * Mutates `enemy.aiState` to record the selection (repeatCount, cooldowns).
 * Does NOT store the result onto `enemy.intent`; callers do that.
 */
export function rollIntent(
	enemy: Enemy,
	def: EnemyDefinition,
	ctx: CombatContext,
	rng: Rng,
): Intent {
	const aiState = enemy.aiState;
	const combatTurn = ctx.turnNumber;
	const player = ctx.getPlayer();

	// 1. forced_opener: on turn 0 always use designated index
	if (combatTurn === 0) {
		const rule = def.aiRules?.find((r) => r.kind === "forced_opener");
		if (rule !== undefined) {
			const pattern = def.intents[rule.intentIndex];
			if (pattern !== undefined) {
				commitSelection(aiState, pattern, rule.intentIndex);
				return pattern.intent;
			}
		}
	}

	// 2. forced_finisher: override everything when HP below threshold
	for (const rule of def.aiRules ?? []) {
		if (rule.kind === "forced_finisher") {
			if (enemy.hp / enemy.maxHp < rule.whenHpBelow) {
				const pattern = def.intents[rule.intentIndex];
				if (pattern !== undefined) {
					commitSelection(aiState, pattern, rule.intentIndex);
					return pattern.intent;
				}
			}
		}
	}

	// 3. Filter by condition and cooldown
	let candidates = def.intents
		.map((pattern, idx) => ({ pattern, idx }))
		.filter(({ pattern, idx }) => {
			if ((aiState.cooldowns[idx] ?? 0) > 0) return false;
			if (pattern.condition !== undefined) {
				return evaluateCondition(pattern.condition, enemy, player, aiState, combatTurn);
			}
			return true;
		});

	// 4. Apply no_repeat_in_a_row
	const noRepeatRule = def.aiRules?.find((r) => r.kind === "no_repeat_in_a_row");
	if (
		noRepeatRule !== undefined &&
		aiState.lastIntentKind !== null &&
		aiState.repeatCount >= noRepeatRule.maxRepeats
	) {
		const filtered = candidates.filter(
			({ pattern }) => pattern.intent.kind !== aiState.lastIntentKind,
		);
		if (filtered.length > 0) candidates = filtered;
	}

	// Fallback: if no valid candidate, use all intents unconditionally
	if (candidates.length === 0) {
		candidates = def.intents.map((pattern, idx) => ({ pattern, idx }));
	}

	// 5. Weighted selection
	const selected = rng.weighted(
		candidates.map(({ pattern, idx }) => ({
			item: { pattern, idx },
			weight: pattern.weight,
		})),
	);

	commitSelection(aiState, selected.pattern, selected.idx);
	return selected.pattern.intent;
}

// ---------------------------------------------------------------------------
// Enemy intent execution
// ---------------------------------------------------------------------------

/**
 * Executes `enemy.intent` against the player.
 * Emits all appropriate events through `ctx`.
 */
export function executeEnemyIntent(enemy: Enemy, ctx: CombatContext): void {
	const intent = enemy.intent;
	if (intent.kind === "unknown") return;

	const player = ctx.state.player;

	switch (intent.kind) {
		case "attack": {
			for (let i = 0; i < intent.hits; i++) {
				ctx.emit({
					type: "DAMAGE_INTENDED",
					sourceId: enemy.id,
					targetId: player.id,
					amount: intent.damage,
					damageTypes: enemy.types,
					damageSource: "enemy",
					cancellable: true,
				});
				if (!isAlive(player)) break;
			}
			if (intent.appliesStatus !== undefined) {
				const status = {
					id: intent.appliesStatus.statusId,
					stacks: intent.appliesStatus.stacks,
					behavior: intent.appliesStatus.behavior,
				};
				applyStatus(player, status);
				ctx.emit({ type: "STATUS_APPLIED", targetId: player.id, status });
			}
			break;
		}

		case "buff": {
			const buff = { id: intent.buffId, stacks: intent.stacks };
			applyBuff(enemy, buff);
			ctx.emit({
				type: "BUFF_APPLIED",
				targetId: enemy.id,
				buffId: String(intent.buffId),
				stacks: intent.stacks,
			});
			break;
		}

		case "debuff": {
			const status = {
				id: intent.statusId,
				stacks: intent.stacks,
				behavior: intent.behavior,
			};
			applyStatus(player, status);
			ctx.emit({ type: "STATUS_APPLIED", targetId: player.id, status });
			break;
		}

		case "defend": {
			gainBlock(enemy, intent.block);
			ctx.emit({ type: "BLOCK_GAINED", entityId: enemy.id, amount: intent.block });
			break;
		}
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function evaluateCondition(
	condition: IntentCondition,
	enemy: Combatant,
	player: Combatant,
	aiState: EnemyAiState,
	combatTurn: number,
): boolean {
	switch (condition.kind) {
		case "hp_below":
			return enemy.hp / enemy.maxHp < condition.threshold;
		case "hp_above":
			return enemy.hp / enemy.maxHp > condition.threshold;
		case "turn_at_least":
			return combatTurn >= condition.turn;
		case "turn_at_most":
			return combatTurn <= condition.turn;
		case "last_intent_was":
			return aiState.lastIntentKind === condition.intentKind;
		case "last_intent_was_not":
			return aiState.lastIntentKind !== condition.intentKind;
		case "player_has_status":
			return player.statuses.some((s) => s.id === condition.statusId);
	}
}

function commitSelection(aiState: EnemyAiState, pattern: IntentPattern, idx: number): void {
	const kind = pattern.intent.kind;

	if (kind === aiState.lastIntentKind) {
		aiState.repeatCount++;
	} else {
		aiState.lastIntentKind = kind;
		aiState.repeatCount = 1;
	}

	// Decrement active cooldowns
	for (const key of Object.keys(aiState.cooldowns)) {
		const n = Number(key);
		const cd = aiState.cooldowns[n] ?? 0;
		if (cd > 0) {
			const next = cd - 1;
			if (next <= 0) {
				// biome-ignore lint/performance/noDelete: cleaning up expired cooldowns
				delete aiState.cooldowns[n];
			} else {
				aiState.cooldowns[n] = next;
			}
		}
	}

	// Set new cooldown for selected pattern
	if (pattern.cooldown !== undefined && pattern.cooldown > 0) {
		aiState.cooldowns[idx] = pattern.cooldown;
	}
}
