import type { PokemonType } from "@core/types/pokemon-types.ts";
import type { CombatContext } from "./effects/effect-handler.ts";
import type { Combatant } from "./entity.ts";

// ---------------------------------------------------------------------------
// Intensity statuses that deal damage when they tick
// ---------------------------------------------------------------------------

const INTENSITY_DAMAGE_TYPES: Readonly<Partial<Record<string, readonly PokemonType[]>>> = {
	burn: ["fire"],
	poison: ["poison"],
	// "doubt" is intensity but lowers stats — no HP damage tick
};

// ---------------------------------------------------------------------------
// Status ticking
// ---------------------------------------------------------------------------

/**
 * Ticks all statuses on `entity` (called at the entity's own TURN_START):
 * - intensity + damage: emits DAMAGE_INTENDED (through full pipeline), then
 *   decrements stacks by 1.
 * - intensity (no damage): decrements stacks by 1.
 * - duration: decrements stacks by 1.
 * Removes status when stacks reach 0 and emits STATUS_TICKED with remainingStacks=0.
 */
export function tickStatuses(entity: Combatant, ctx: CombatContext): void {
	const toRemove: Array<string> = [];

	for (const status of entity.statuses) {
		// Apply tick damage for relevant intensity statuses
		const dmgTypes = INTENSITY_DAMAGE_TYPES[String(status.id)];
		if (status.behavior === "intensity" && dmgTypes !== undefined) {
			ctx.emit({
				type: "DAMAGE_INTENDED",
				sourceId: entity.id,
				targetId: entity.id,
				amount: status.stacks,
				damageTypes: dmgTypes,
				damageSource: "status",
				cancellable: true,
			});
		}

		// Decrement stacks
		status.stacks -= 1;
		ctx.emit({
			type: "STATUS_TICKED",
			targetId: entity.id,
			statusId: status.id,
			remainingStacks: status.stacks,
		});

		if (status.stacks <= 0) {
			toRemove.push(String(status.id));
		}
	}

	// Remove expired statuses after iteration
	if (toRemove.length > 0) {
		entity.statuses = entity.statuses.filter((s) => !toRemove.includes(String(s.id)));
	}
}

// ---------------------------------------------------------------------------
// Buff ticking
// ---------------------------------------------------------------------------

/**
 * Ticks duration-limited buffs on `entity`.
 * Permanent buffs (duration === undefined) are untouched.
 * Emits BUFF_EXPIRED when a buff is removed.
 */
export function tickBuffs(entity: Combatant, ctx: CombatContext): void {
	const toRemove: Array<string> = [];

	for (const buff of entity.buffs) {
		if (buff.duration === undefined) continue; // permanent buff

		buff.duration -= 1;
		if (buff.duration <= 0) {
			toRemove.push(String(buff.id));
			ctx.emit({ type: "BUFF_EXPIRED", entityId: entity.id, buffId: buff.id });
		}
	}

	if (toRemove.length > 0) {
		entity.buffs = entity.buffs.filter((b) => !toRemove.includes(String(b.id)));
	}
}
