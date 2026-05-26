import type { Combatant, Enemy, EntityId, Player } from "../entity.ts";
import type { GameEvent } from "./game-events.ts";

// CardInstance lives in card-definition.ts (canonical); re-exported here for back-compat.
export type { CardInstance } from "@core/cards/card-definition.ts";

// ---------------------------------------------------------------------------
// FSM phase — serialisable; stored on CombatContext (not CombatState) so
// existing CombatState fixtures in tests don't need to change.
// ---------------------------------------------------------------------------

export type CombatPhase = "PLAYER_TURN" | "ENEMY_TURN" | "WIN" | "LOSE";

// ---------------------------------------------------------------------------
// Combat state bag — everything handlers may need to read or mutate
// ---------------------------------------------------------------------------

export interface CombatState {
	player: Player;
	enemies: Enemy[];
	hand: CardInstance[];
	drawPile: CardInstance[];
	discardPile: CardInstance[];
	exhaustPile: CardInstance[];
}

// ---------------------------------------------------------------------------
// EffectHandler
// ---------------------------------------------------------------------------

export interface EffectHandler {
	/** Unique ID used for unregistration. */
	readonly id: string;
	/** Lower priority runs first. */
	readonly priority: number;
	/** Event type this handler subscribes to. */
	readonly on: GameEvent["type"];
	/**
	 * Transform the event, apply side-effects, or cancel it.
	 *
	 * Return a (modified) GameEvent to continue the chain.
	 * Return null to attempt cancellation — only honoured if the event has
	 * `cancellable: true`; otherwise treated as a pass-through.
	 * For non-cancellable events, a null return is treated as pass-through.
	 */
	handle(event: GameEvent, ctx: CombatContext): GameEvent | null;
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

export interface LogEntry {
	readonly tick: number;
	readonly event: GameEvent;
	readonly cancelled: boolean;
}

// ---------------------------------------------------------------------------
// CombatContext
// ---------------------------------------------------------------------------

export class CombatContext {
	readonly state: CombatState;
	readonly log: LogEntry[] = [];

	/** FSM phase — mutated by the turn engine; not part of CombatState so
	 *  existing test fixtures creating CombatState objects don't need updating. */
	phase: CombatPhase = "PLAYER_TURN";

	/** Overall combat turn counter (increments after each enemy turn completes). */
	turnNumber: number = 0;

	/**
	 * Mutable flags for handler-to-handler communication within a single
	 * event chain.  Convention: flag keys are `"handler-id:flag-name"`.
	 * Example: default block-reset handler checks `flags["skipBlockReset"]`.
	 */
	readonly flags: Record<string, boolean> = {};

	private readonly handlersByType = new Map<string, EffectHandler[]>();
	private tick = 0;

	constructor(state: CombatState) {
		this.state = state;
	}

	// -------------------------------------------------------------------------
	// Handler registration
	// -------------------------------------------------------------------------

	registerHandler(handler: EffectHandler): void {
		const list = this.handlersByType.get(handler.on) ?? [];
		list.push(handler);
		list.sort((a, b) => a.priority - b.priority);
		this.handlersByType.set(handler.on, list);
	}

	unregisterHandler(id: string): void {
		for (const [type, list] of this.handlersByType) {
			const filtered = list.filter((h) => h.id !== id);
			if (filtered.length !== list.length) {
				this.handlersByType.set(type, filtered);
			}
		}
	}

	getHandlersFor(type: GameEvent["type"]): readonly EffectHandler[] {
		return this.handlersByType.get(type) ?? [];
	}

	// -------------------------------------------------------------------------
	// Event emission — core of the engine
	// -------------------------------------------------------------------------

	/**
	 * Runs the full handler chain for `event`.
	 *
	 * Each handler may transform the event; the next handler receives the
	 * transformed version. If a handler returns null AND the event carries
	 * `cancellable: true`, emission stops and null is returned (cancelled).
	 * For non-cancellable events, a null return is treated as pass-through.
	 *
	 * Returns the final (possibly transformed) event, or null if cancelled.
	 */
	emit(event: GameEvent): GameEvent | null {
		const handlers = this.getHandlersFor(event.type);
		let current: GameEvent = event;

		for (const handler of handlers) {
			const result = handler.handle(current, this);

			if (result === null) {
				const isCancellable = "cancellable" in current && current.cancellable === true;
				if (isCancellable) {
					this.log.push({ tick: this.tick++, event: current, cancelled: true });
					return null;
				}
				// Non-cancellable — treat null as pass-through
			} else {
				current = result;
			}
		}

		this.log.push({ tick: this.tick++, event: current, cancelled: false });
		return current;
	}

	// -------------------------------------------------------------------------
	// State accessors
	// -------------------------------------------------------------------------

	getCombatant(id: EntityId): Combatant | undefined {
		if (this.state.player.id === id) return this.state.player;
		return this.state.enemies.find((e) => e.id === id);
	}

	getPlayer(): Player {
		return this.state.player;
	}

	getEnemies(): readonly Enemy[] {
		return this.state.enemies;
	}

	/** Remove a defeated enemy from the active enemies list. */
	removeEnemy(id: EntityId): void {
		this.state.enemies = this.state.enemies.filter((e) => e.id !== id);
	}
}
