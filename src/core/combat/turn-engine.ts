import { executeCard } from "@core/cards/card-executor.ts";
import { getCardDefinition } from "@core/cards/card-registry.ts";
import { discardHand, drawCards } from "@core/cards/deck-manager.ts";
import { executeEnemyIntent, rollIntent } from "@core/enemies/enemy-ai.ts";
import { getEnemyDefinition } from "@core/enemies/enemy-registry.ts";
import type { Rng } from "@core/rng/rng.ts";
import type { CombatContext, EffectHandler } from "./effects/effect-handler.ts";
import { isAlive, takeDamage } from "./entity.ts";
import { tickBuffs, tickStatuses } from "./status-ticks.ts";

// ---------------------------------------------------------------------------
// Default combat handlers (registered once at startCombat)
// ---------------------------------------------------------------------------

/**
 * Registers the baseline handlers every combat needs:
 *   - damage-applier: DAMAGE_INTENDED → applies HP damage → emits DAMAGE_DEALT
 *   - block-reset: TURN_START → zeroes block unless `flags.skipBlockReset`
 *
 * Priority conventions:
 *   damage-applier: 9000 (last — after all modification handlers)
 *   block-reset:    1000 (late — relics can cancel with lower priority)
 */
export function registerDefaultHandlers(ctx: CombatContext): void {
	const damageApplier: EffectHandler = {
		id: "default:damage-applier",
		priority: 9000,
		on: "DAMAGE_INTENDED",
		handle(event, c) {
			if (event.type !== "DAMAGE_INTENDED") return event;
			const target = c.getCombatant(event.targetId);
			if (target === undefined) return event;

			const hpDmg = takeDamage(target, event.amount);
			c.emit({
				type: "DAMAGE_DEALT",
				sourceId: event.sourceId,
				targetId: event.targetId,
				finalAmount: hpDmg,
			});

			if (!isAlive(target)) {
				c.emit({ type: "ENTITY_DEFEATED", entityId: target.id });
			}

			return event;
		},
	};

	const blockReset: EffectHandler = {
		id: "default:block-reset",
		priority: 1000,
		on: "TURN_START",
		handle(event, c) {
			if (event.type !== "TURN_START") return event;
			if (c.flags.skipBlockReset === true) return event;

			if (event.isPlayer) {
				c.state.player.block = 0;
			} else {
				const enemy = c.getCombatant(event.entityId);
				if (enemy !== undefined) enemy.block = 0;
			}

			return event;
		},
	};

	ctx.registerHandler(damageApplier);
	ctx.registerHandler(blockReset);
}

// ---------------------------------------------------------------------------
// Win/loss check — called after any event that could change HP
// ---------------------------------------------------------------------------

export function checkWinLoss(ctx: CombatContext): "WIN" | "LOSE" | null {
	if (ctx.state.enemies.every((e) => !isAlive(e))) return "WIN";
	if (!isAlive(ctx.state.player)) return "LOSE";
	return null;
}

// ---------------------------------------------------------------------------
// Player turn orchestration
// ---------------------------------------------------------------------------

/**
 * Runs the PLAYER_TURN_START sequence:
 * a. Tick player buffs (duration-limited ones decremented)
 * b. Tick player statuses (Burn/Poison → DAMAGE_INTENDED pipeline)
 * c. Refill energy to maxEnergy
 * d. Draw drawPerTurn cards
 * e. Emit TURN_START (default block-reset handler fires here at priority 1000)
 *
 * Does NOT set ctx.phase — callers do that so combat-fsm controls the phase.
 */
export function beginPlayerTurn(ctx: CombatContext, rng: Rng): void {
	const player = ctx.state.player;

	// a. Tick player buffs
	tickBuffs(player, ctx);

	// b. Tick player statuses
	tickStatuses(player, ctx);

	// Early exit if player died from self-inflicted status (edge case: flare-blitz burn)
	if (checkWinLoss(ctx) !== null) return;

	// c. Refill energy
	const prevEnergy = player.energy;
	player.energy = player.maxEnergy;
	if (player.energy !== prevEnergy) {
		ctx.emit({
			type: "ENERGY_CHANGED",
			entityId: player.id,
			delta: player.energy - prevEnergy,
			newTotal: player.energy,
		});
	}

	// d. Draw cards
	drawCards(player.drawPerTurn, ctx, rng);

	// e. Emit TURN_START (triggers block-reset handler + any relic listeners)
	ctx.emit({ type: "TURN_START", entityId: player.id, isPlayer: true });
}

// ---------------------------------------------------------------------------
// Card play (public API — handles full lifecycle)
// ---------------------------------------------------------------------------

/**
 * Plays a card from the player's hand.
 * Validates energy, executes effects, moves card to discard (unless exhausted).
 * Checks for win/loss and updates ctx.phase accordingly.
 *
 * Returns `{ played: true }` on success or `{ played: false, reason }`.
 */
export function playCard(
	instanceId: string,
	targetId: string | undefined,
	ctx: CombatContext,
	rng: Rng,
): { readonly played: boolean; readonly reason?: string } {
	if (ctx.phase !== "PLAYER_TURN") {
		return { played: false, reason: "not player turn" };
	}

	const inst = ctx.state.hand.find((c) => c.instanceId === instanceId);
	if (inst === undefined) {
		return { played: false, reason: "card not in hand" };
	}

	const def = getCardDefinition(inst.definitionId);
	const player = ctx.state.player;

	if (player.energy < def.energyCost) {
		return { played: false, reason: "insufficient energy" };
	}

	executeCard(inst, def, targetId, ctx, rng);

	// If the card wasn't exhausted by its own effect, move hand → discard
	const wasExhausted = ctx.state.exhaustPile.some((c) => c.instanceId === instanceId);
	if (!wasExhausted) {
		ctx.state.hand = ctx.state.hand.filter((c) => c.instanceId !== instanceId);
		ctx.state.discardPile.push(inst);
		ctx.emit({ type: "CARD_DISCARDED", cardInstanceId: instanceId });
	}

	// Immediate win check (enemy may have died from card damage)
	const result = checkWinLoss(ctx);
	if (result !== null) {
		ctx.phase = result;
		ctx.emit({ type: "COMBAT_END", outcome: result === "WIN" ? "victory" : "defeat" });
	}

	return { played: true };
}

// ---------------------------------------------------------------------------
// End player turn → run enemy turns → begin next player turn
// ---------------------------------------------------------------------------

/**
 * Called when the player explicitly ends their turn.
 * Discards remaining hand, runs all enemy turns (tick → intent execute → roll
 * next intent), then starts the next player turn unless combat ended.
 */
export function endPlayerTurn(ctx: CombatContext, rng: Rng): void {
	if (ctx.phase !== "PLAYER_TURN") return;

	const player = ctx.state.player;

	// Discard remaining hand
	discardHand(ctx);
	ctx.emit({ type: "TURN_END", entityId: player.id, isPlayer: true });

	// ── Enemy turn ──────────────────────────────────────────────────────────
	ctx.phase = "ENEMY_TURN";

	for (const enemy of ctx.state.enemies) {
		if (!isAlive(enemy)) continue;

		// a. Tick enemy buffs
		tickBuffs(enemy, ctx);

		// b. Tick enemy statuses
		tickStatuses(enemy, ctx);

		// c. Enemy may have died from status tick — skip intent if so
		if (!isAlive(enemy)) {
			checkAndFinalise(ctx, rng);
			if (ctx.phase !== "ENEMY_TURN") return;
			continue;
		}

		// d. TURN_START for enemy (block reset handler fires)
		ctx.emit({ type: "TURN_START", entityId: enemy.id, isPlayer: false });

		// e. Execute telegraphed intent
		executeEnemyIntent(enemy, ctx);

		// f. Check for player death
		const afterAttack = checkWinLoss(ctx);
		if (afterAttack !== null) {
			ctx.phase = afterAttack;
			ctx.emit({
				type: "COMBAT_END",
				outcome: afterAttack === "WIN" ? "victory" : "defeat",
			});
			return;
		}

		// g. TURN_END for enemy
		ctx.emit({ type: "TURN_END", entityId: enemy.id, isPlayer: false });

		// h. Roll next intent (telegraphed to player at start of next player turn)
		const def = getEnemyDefinition(enemy.definitionId);
		enemy.intent = rollIntent(enemy, def, ctx, rng);
		ctx.emit({ type: "ENEMY_INTENT_RESOLVED", enemyId: enemy.id, intent: enemy.intent });
	}

	// Post all-enemy-turns: check for win (all enemies dead from status ticks)
	checkAndFinalise(ctx, rng);
}

// ---------------------------------------------------------------------------
// Internal helper — finalise combat or start next player turn
// ---------------------------------------------------------------------------

function checkAndFinalise(ctx: CombatContext, rng: Rng): void {
	const result = checkWinLoss(ctx);
	if (result !== null) {
		ctx.phase = result;
		ctx.emit({
			type: "COMBAT_END",
			outcome: result === "WIN" ? "victory" : "defeat",
		});
		return;
	}

	// Advance turn counter and start next player turn
	ctx.turnNumber++;
	ctx.phase = "PLAYER_TURN";
	beginPlayerTurn(ctx, rng);
}
