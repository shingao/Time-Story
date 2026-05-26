import type { PokemonType } from "@core/types/pokemon-types.ts";
import type { CardId, EntityId, Status, StatusId } from "../entity.ts";

// ---------------------------------------------------------------------------
// GameEvent — every combat action is expressed as one of these
// ---------------------------------------------------------------------------

export type GameEvent =
	// Card lifecycle
	| { readonly type: "CARD_PLAYED"; readonly cardId: CardId; readonly targetId?: EntityId }
	| { readonly type: "CARD_DRAWN"; readonly cardInstanceId: string }
	| { readonly type: "CARD_DISCARDED"; readonly cardInstanceId: string }
	| { readonly type: "CARD_EXHAUSTED"; readonly cardInstanceId: string }
	| { readonly type: "DECK_RESHUFFLED" }
	// Damage pipeline — two-phase so handlers can intercept before application
	| {
			readonly type: "DAMAGE_INTENDED";
			readonly sourceId: EntityId;
			readonly targetId: EntityId;
			readonly amount: number;
			readonly damageTypes: readonly PokemonType[];
			readonly cancellable: true;
	  }
	| {
			readonly type: "DAMAGE_DEALT";
			readonly sourceId: EntityId;
			readonly targetId: EntityId;
			readonly finalAmount: number;
	  }
	// Block
	| { readonly type: "BLOCK_GAINED"; readonly entityId: EntityId; readonly amount: number }
	// Healing
	| { readonly type: "HEAL"; readonly targetId: EntityId; readonly amount: number }
	// Energy
	| {
			readonly type: "ENERGY_CHANGED";
			readonly entityId: EntityId;
			readonly delta: number;
			readonly newTotal: number;
	  }
	// Turn management
	| { readonly type: "TURN_START"; readonly entityId: EntityId; readonly isPlayer: boolean }
	| { readonly type: "TURN_END"; readonly entityId: EntityId; readonly isPlayer: boolean }
	// Status / buff
	| { readonly type: "STATUS_APPLIED"; readonly targetId: EntityId; readonly status: Status }
	| {
			readonly type: "STATUS_TICKED";
			readonly targetId: EntityId;
			readonly statusId: StatusId;
			readonly remainingStacks: number;
	  }
	| {
			readonly type: "BUFF_APPLIED";
			readonly targetId: EntityId;
			readonly buffId: string;
			readonly stacks: number;
	  }
	// Entity lifecycle
	| { readonly type: "ENTITY_DEFEATED"; readonly entityId: EntityId }
	// Combat lifecycle
	| { readonly type: "COMBAT_START" }
	| { readonly type: "COMBAT_END"; readonly outcome: "victory" | "defeat" };

// ---------------------------------------------------------------------------
// Helpers for building modified events (handlers must return new objects)
// ---------------------------------------------------------------------------

type DamageIntendedEvent = Extract<GameEvent, { type: "DAMAGE_INTENDED" }>;

/** Returns a new DAMAGE_INTENDED with a different amount — use in handler chains. */
export function withAmount(event: DamageIntendedEvent, newAmount: number): DamageIntendedEvent {
	return { ...event, amount: newAmount };
}
