import type { StarterName } from "@core/cards/card-registry.ts";

export type { StarterName };

// ---------------------------------------------------------------------------
// PlayerSnapshot — full run snapshot with stubs
// ---------------------------------------------------------------------------

export interface PlayerSnapshot {
	readonly currentHp: number;
	readonly maxHp: number;
	readonly gold: number;
	readonly deckCardIds: readonly string[]; // definitionIds with duplicates for multiples
	readonly relicIds: readonly string[]; // empty for now
	readonly partnerState: null; // stub
	readonly timeGearCount: number; // stub = 0
}

// ---------------------------------------------------------------------------
// RunStatus — current run phase
// ---------------------------------------------------------------------------

export type RunStatus =
	| "in_map"
	| "in_combat"
	| "in_event"
	| "in_shop"
	| "in_campfire"
	| "in_treasure"
	| "victory"
	| "defeat";
