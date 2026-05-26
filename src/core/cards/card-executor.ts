import type { CardInstance, CombatContext } from "@core/combat/effects/effect-handler.ts";
import {
	applyBuff,
	applyStatus,
	asBuffId,
	asEntityId,
	findBuff,
	findStatus,
	gainBlock,
	heal,
	type Player,
} from "@core/combat/entity.ts";
import type { Rng } from "@core/rng/rng.ts";
import type {
	CardDefinition,
	CardEffect,
	EffectCondition,
	EffectScaling,
	ResolvedCard,
} from "./card-definition.ts";
import { resolveCard } from "./card-definition.ts";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Executes a card: deducts energy, emits CARD_PLAYED, runs all effects in order.
 * Callers must verify the player has sufficient energy before calling.
 */
export function executeCard(
	instance: CardInstance,
	def: CardDefinition,
	targetId: string | undefined,
	ctx: CombatContext,
	_rng: Rng, // reserved for probabilistic effects in future phases
): void {
	const resolved = resolveCard(def, instance.upgradeLevel);
	const player = ctx.getPlayer();

	player.energy = Math.max(0, player.energy - resolved.energyCost);
	ctx.emit({
		type: "ENERGY_CHANGED",
		entityId: player.id,
		delta: -resolved.energyCost,
		newTotal: player.energy,
	});

	ctx.emit({
		type: "CARD_PLAYED",
		cardId: def.id,
		...(targetId !== undefined ? { targetId: asEntityId(targetId) } : {}),
	});

	for (const effect of resolved.effects) {
		applyEffect(effect, resolved, targetId, ctx, player);
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeScaling(
	scaling: EffectScaling | undefined,
	ctx: CombatContext,
	player: Player,
): number {
	if (scaling === undefined) return 0;
	const { source, factor } = scaling;
	switch (source) {
		case "strength":
			return (findBuff(player, asBuffId("strength"))?.stacks ?? 0) * factor;
		case "focus":
			return (findBuff(player, asBuffId("focus"))?.stacks ?? 0) * factor;
		case "rage":
			return (findBuff(player, asBuffId("rage"))?.stacks ?? 0) * factor;
		case "energy":
			return player.energy * factor;
		case "handSize":
			return ctx.state.hand.length * factor;
	}
}

function conditionMet(
	condition: EffectCondition,
	targetId: string | undefined,
	ctx: CombatContext,
	player: Player,
): boolean {
	switch (condition.when) {
		case "targetHasStatus": {
			if (targetId === undefined) return false;
			const target = ctx.getCombatant(asEntityId(targetId));
			return target !== undefined && findStatus(target, condition.statusId) !== undefined;
		}
		case "selfHasBuff": {
			const buff = findBuff(player, condition.buffId);
			if (buff === undefined) return false;
			return condition.minStacks === undefined || buff.stacks >= condition.minStacks;
		}
		case "energyAtLeast":
			return player.energy >= condition.amount;
		case "handSizeAtLeast":
			return ctx.state.hand.length >= condition.count;
	}
}

function applyEffect(
	effect: CardEffect,
	card: ResolvedCard,
	targetId: string | undefined,
	ctx: CombatContext,
	player: Player,
): void {
	if ("condition" in effect && effect.condition !== undefined) {
		if (!conditionMet(effect.condition, targetId, ctx, player)) return;
	}

	switch (effect.kind) {
		case "damage": {
			if (targetId === undefined) return;
			const target = ctx.getCombatant(asEntityId(targetId));
			if (target === undefined) return;
			const amount = Math.max(0, effect.amount + computeScaling(effect.scaling, ctx, player));
			ctx.emit({
				type: "DAMAGE_INTENDED",
				sourceId: player.id,
				targetId: target.id,
				amount,
				damageTypes: effect.damageTypes ?? card.types,
				cancellable: true,
			});
			break;
		}

		case "block": {
			const amount = Math.max(0, effect.amount + computeScaling(effect.scaling, ctx, player));
			gainBlock(player, amount);
			ctx.emit({ type: "BLOCK_GAINED", entityId: player.id, amount });
			break;
		}

		case "applyStatus": {
			const toSelf = effect.toSelf ?? false;
			const entityId = toSelf
				? player.id
				: targetId !== undefined
					? asEntityId(targetId)
					: undefined;
			if (entityId === undefined) return;
			const entity = ctx.getCombatant(entityId);
			if (entity === undefined) return;
			const status = { id: effect.statusId, stacks: effect.stacks, behavior: effect.behavior };
			applyStatus(entity, status);
			ctx.emit({ type: "STATUS_APPLIED", targetId: entity.id, status });
			break;
		}

		case "applyBuff": {
			const toSelf = effect.toSelf ?? true;
			const entityId = toSelf
				? player.id
				: targetId !== undefined
					? asEntityId(targetId)
					: undefined;
			if (entityId === undefined) return;
			const entity = ctx.getCombatant(entityId);
			if (entity === undefined) return;
			const buff = { id: effect.buffId, stacks: effect.stacks };
			applyBuff(entity, buff);
			ctx.emit({
				type: "BUFF_APPLIED",
				targetId: entity.id,
				buffId: String(effect.buffId),
				stacks: effect.stacks,
			});
			break;
		}

		case "removeStatus": {
			const fromSelf = effect.fromSelf ?? false;
			const entity = fromSelf
				? player
				: targetId !== undefined
					? ctx.getCombatant(asEntityId(targetId))
					: undefined;
			if (entity !== undefined) {
				entity.statuses = entity.statuses.filter((s) => s.id !== effect.statusId);
			}
			break;
		}

		case "heal": {
			const amount = Math.max(0, effect.amount + computeScaling(effect.scaling, ctx, player));
			heal(player, amount);
			ctx.emit({ type: "HEAL", targetId: player.id, amount });
			break;
		}

		case "drawCards": {
			// DeckManager (Phase 2.2) will intercept these and fulfil actual draws.
			for (let i = 0; i < effect.count; i++) {
				ctx.emit({ type: "CARD_DRAWN", cardInstanceId: `pending-draw-${i}` });
			}
			break;
		}

		case "gainEnergy": {
			player.energy = Math.min(player.maxEnergy, player.energy + effect.amount);
			ctx.emit({
				type: "ENERGY_CHANGED",
				entityId: player.id,
				delta: effect.amount,
				newTotal: player.energy,
			});
			break;
		}

		case "exhaust": {
			ctx.emit({ type: "CARD_EXHAUSTED", cardInstanceId: "self" });
			break;
		}
	}
}
