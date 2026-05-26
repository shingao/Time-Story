import type { EnemyId, Intent, StatusId } from "@core/combat/entity.ts";
import type { PokemonType } from "@core/types/pokemon-types.ts";

// ---------------------------------------------------------------------------
// IntentCondition — gates whether an intent pattern can be selected
// ---------------------------------------------------------------------------

export type IntentCondition =
	| { readonly kind: "hp_below"; readonly threshold: number } // e.g. 0.5 = below 50% HP
	| { readonly kind: "hp_above"; readonly threshold: number }
	| { readonly kind: "turn_at_least"; readonly turn: number } // unlock after turn N
	| { readonly kind: "turn_at_most"; readonly turn: number }
	| { readonly kind: "last_intent_was"; readonly intentKind: Intent["kind"] }
	| { readonly kind: "last_intent_was_not"; readonly intentKind: Intent["kind"] }
	| { readonly kind: "player_has_status"; readonly statusId: StatusId };

// ---------------------------------------------------------------------------
// AiRule — post-selection constraints / overrides
// ---------------------------------------------------------------------------

export type AiRule =
	| { readonly kind: "no_repeat_in_a_row"; readonly maxRepeats: number }
	| { readonly kind: "forced_opener"; readonly intentIndex: number }
	| {
			readonly kind: "forced_finisher";
			readonly intentIndex: number;
			readonly whenHpBelow: number;
	  };

// ---------------------------------------------------------------------------
// IntentPattern — one row in the enemy's move table
// ---------------------------------------------------------------------------

export interface IntentPattern {
	readonly weight: number;
	readonly intent: Intent;
	readonly condition?: IntentCondition;
	readonly cooldown?: number; // turns before this pattern can fire again
}

// ---------------------------------------------------------------------------
// EnemyDefinition — static, serialisable enemy record (validated from JSON)
// ---------------------------------------------------------------------------

export interface EnemyDefinition {
	readonly id: EnemyId;
	readonly name: string;
	readonly types: readonly [PokemonType, ...PokemonType[]];
	readonly hp: { readonly min: number; readonly max: number };
	readonly tier: "normal" | "elite" | "boss";
	readonly intents: readonly IntentPattern[];
	readonly aiRules?: readonly AiRule[];
	readonly spriteId?: string;
	readonly resistances?: readonly PokemonType[];
}
