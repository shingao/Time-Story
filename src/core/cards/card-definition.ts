import type { BuffId, CardId, StatusBehavior, StatusId } from "@core/combat/entity.ts";
import type { PokemonType } from "@core/types/pokemon-types.ts";

// ---------------------------------------------------------------------------
// Scaling — a buff or stat whose value is multiplied and added to an effect
// ---------------------------------------------------------------------------

export type ScalingSource = "strength" | "focus" | "rage" | "energy" | "handSize";

export interface EffectScaling {
	readonly source: ScalingSource;
	readonly factor: number;
}

// ---------------------------------------------------------------------------
// Conditions — optional gate; if false the effect is skipped
// ---------------------------------------------------------------------------

export type EffectCondition =
	| { readonly when: "targetHasStatus"; readonly statusId: StatusId }
	| { readonly when: "selfHasBuff"; readonly buffId: BuffId; readonly minStacks?: number }
	| { readonly when: "energyAtLeast"; readonly amount: number }
	| { readonly when: "handSizeAtLeast"; readonly count: number };

// ---------------------------------------------------------------------------
// CardEffect — everything a card can do, expressed declaratively
// ---------------------------------------------------------------------------

export type CardEffect =
	// Deal damage to the target (two-phase pipeline via DAMAGE_INTENDED event)
	| {
			readonly kind: "damage";
			readonly amount: number;
			readonly damageTypes?: readonly PokemonType[];
			readonly scaling?: EffectScaling;
			readonly condition?: EffectCondition;
	  }
	// Gain block (applied to the caster/player)
	| {
			readonly kind: "block";
			readonly amount: number;
			readonly scaling?: EffectScaling;
			readonly condition?: EffectCondition;
	  }
	// Apply a status condition; toSelf defaults false (→ targetId = enemy)
	| {
			readonly kind: "applyStatus";
			readonly statusId: StatusId;
			readonly behavior: StatusBehavior;
			readonly stacks: number;
			readonly toSelf?: boolean;
			readonly condition?: EffectCondition;
	  }
	// Apply a buff; toSelf defaults true (→ player buffs themselves)
	| {
			readonly kind: "applyBuff";
			readonly buffId: BuffId;
			readonly stacks: number;
			readonly toSelf?: boolean;
			readonly condition?: EffectCondition;
	  }
	// Remove a status; fromSelf defaults false (→ from targetId)
	| { readonly kind: "removeStatus"; readonly statusId: StatusId; readonly fromSelf?: boolean }
	// Heal the player
	| { readonly kind: "heal"; readonly amount: number; readonly scaling?: EffectScaling }
	// Request N card draws (fulfilled by DeckManager in Phase 2.2)
	| { readonly kind: "drawCards"; readonly count: number }
	// Give the player extra energy this turn
	| { readonly kind: "gainEnergy"; readonly amount: number }
	// Exhaust this card (move to exhaust pile) after resolution
	| { readonly kind: "exhaust" };

// ---------------------------------------------------------------------------
// Metadata enums
// ---------------------------------------------------------------------------

export type CardCategory = "attack" | "skill" | "power";
export type CardRarity = "starter" | "common" | "uncommon" | "rare";
export type CardTarget = "enemy" | "allEnemies" | "self" | "none";

// ---------------------------------------------------------------------------
// Upgrade override — only the fields that may differ at upgrade level 1
// ---------------------------------------------------------------------------

export interface CardUpgrade {
	readonly name?: string;
	readonly description?: string;
	readonly energyCost?: number;
	readonly effects?: readonly CardEffect[];
}

// ---------------------------------------------------------------------------
// CardDefinition — static, serialisable card record
// ---------------------------------------------------------------------------

export interface CardDefinition {
	readonly id: CardId;
	readonly name: string;
	readonly description: string;
	readonly types: readonly [PokemonType, ...PokemonType[]]; // at least one type required
	readonly category: CardCategory;
	readonly rarity: CardRarity;
	readonly energyCost: number;
	readonly target: CardTarget;
	readonly effects: readonly CardEffect[];
	readonly upgradeMap?: CardUpgrade;
	readonly evolvesTo?: CardId;
	readonly tags?: readonly string[];
}

// ---------------------------------------------------------------------------
// CardInstance — a runtime copy of a card living in the player's deck
// (canonical home; re-exported from effect-handler.ts for back-compat)
// ---------------------------------------------------------------------------

export interface CardInstance {
	readonly instanceId: string;
	readonly definitionId: CardId;
	readonly upgradeLevel: 0 | 1 | 2;
}

// ---------------------------------------------------------------------------
// ResolvedCard — definition merged with its upgrade override
// ---------------------------------------------------------------------------

export interface ResolvedCard extends CardDefinition {
	readonly upgradeLevel: 0 | 1 | 2;
}

// ---------------------------------------------------------------------------
// resolveCard — merges upgradeMap into definition at the given level
// ---------------------------------------------------------------------------

export function resolveCard(def: CardDefinition, upgradeLevel: 0 | 1 | 2): ResolvedCard {
	if (upgradeLevel === 0 || def.upgradeMap === undefined) {
		return { ...def, upgradeLevel };
	}
	return { ...def, ...def.upgradeMap, upgradeLevel };
}
