import type { PokemonType } from "./pokemon-types.ts";
import { TYPE_CHART } from "./type-chart.ts";

export type Effectiveness = "immune" | "resisted" | "neutral" | "super" | "ultra";

export type DualTypeBehavior = "first" | "best" | "average";

export interface DamageModifier {
	readonly kind: "multiply" | "add" | "set";
	readonly value: number;
}

export interface DamageResult {
	readonly finalDamage: number;
	readonly effectiveness: Effectiveness;
	readonly multiplier: number;
}

function effectivenessLabel(multiplier: number): Effectiveness {
	if (multiplier === 0) return "immune";
	if (multiplier < 1) return "resisted";
	if (multiplier === 1) return "neutral";
	if (multiplier < 4) return "super";
	return "ultra";
}

/**
 * Returns the combined type effectiveness multiplier of one attacking type
 * against all defending types (multiplied together for dual-type defenders).
 */
export function getEffectiveness(
	attackingType: PokemonType,
	defendingTypes: readonly PokemonType[],
): number {
	if (defendingTypes.length === 0) {
		throw new Error("defendingTypes must not be empty");
	}

	const row = TYPE_CHART[attackingType];
	return defendingTypes.reduce((acc, defType) => acc * row[defType], 1);
}

/**
 * Calculates damage with full type effectiveness and optional modifiers.
 *
 * dualTypeBehavior controls how a multi-type attack card resolves:
 *   'first'   — only the first type in attackTypes is used (default for most cards)
 *   'best'    — highest effectiveness across all attack types wins
 *   'average' — average multiplier across attack types
 */
export function calculateDamage(params: {
	readonly baseDamage: number;
	readonly attackTypes: readonly PokemonType[];
	readonly defenderTypes: readonly PokemonType[];
	readonly modifiers?: readonly DamageModifier[];
	readonly dualTypeBehavior?: DualTypeBehavior;
}): DamageResult {
	const {
		baseDamage,
		attackTypes,
		defenderTypes,
		modifiers = [],
		dualTypeBehavior = "first",
	} = params;

	if (attackTypes.length === 0) {
		throw new Error("attackTypes must not be empty");
	}
	if (defenderTypes.length === 0) {
		throw new Error("defenderTypes must not be empty");
	}

	const multiplier = resolveAttackMultiplier(attackTypes, defenderTypes, dualTypeBehavior);

	let damage = baseDamage * multiplier;

	for (const mod of modifiers) {
		switch (mod.kind) {
			case "multiply":
				damage *= mod.value;
				break;
			case "add":
				damage += mod.value;
				break;
			case "set":
				damage = mod.value;
				break;
		}
	}

	const finalDamage = Math.max(0, Math.floor(damage));

	return {
		finalDamage,
		effectiveness: effectivenessLabel(multiplier),
		multiplier,
	};
}

function resolveAttackMultiplier(
	attackTypes: readonly PokemonType[],
	defenderTypes: readonly PokemonType[],
	behavior: DualTypeBehavior,
): number {
	if (attackTypes.length === 1 || behavior === "first") {
		const firstType = attackTypes[0];
		if (firstType === undefined) throw new Error("attackTypes must not be empty");
		return getEffectiveness(firstType, defenderTypes);
	}

	const multipliers = attackTypes.map((t) => getEffectiveness(t, defenderTypes));

	if (behavior === "best") {
		return Math.max(...multipliers);
	}

	// average
	const sum = multipliers.reduce((a, b) => a + b, 0);
	return sum / multipliers.length;
}
