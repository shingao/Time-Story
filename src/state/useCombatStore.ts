import { startCombat } from "@core/combat/combat-fsm.ts";
import type { CombatPhase, CombatState } from "@core/combat/effects/effect-handler.ts";
import { CombatContext } from "@core/combat/effects/effect-handler.ts";
import type { GameEvent } from "@core/combat/effects/game-events.ts";
import { playCard as corePlayCard, endPlayerTurn } from "@core/combat/turn-engine.ts";
import { Rng } from "@core/rng/rng.ts";
import { create } from "zustand";

// ---------------------------------------------------------------------------
// Animation pipeline types
// ---------------------------------------------------------------------------

/**
 * Why each animation frame fired.  The UI uses this to choose the animation
 * clip — e.g. enemy attack vs. status burn vs. card effect.
 */
export type ActionSource = "card" | "status" | "enemy_intent" | "turn_transition";

/**
 * A single event waiting to be animated and consumed by the UI.
 * Tick is monotonically increasing within a combat — never resets.
 */
export interface AnimationFrame {
	readonly tick: number;
	readonly event: GameEvent;
	readonly source: ActionSource;
}

// ---------------------------------------------------------------------------
// Module-level engine refs (NOT in Zustand state — they are not serialisable)
//
// The CombatContext owns the live game state and the handler registry.
// Zustand owns the serialisable snapshot that React renders.
// ---------------------------------------------------------------------------

let _engineCtx: CombatContext | null = null;
let _engineRng: Rng | null = null;

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface CombatSnapshot {
	readonly combatState: CombatState | null;
	readonly phase: CombatPhase;
	readonly turnNumber: number;
	readonly animationQueue: readonly AnimationFrame[];
	readonly lastResolvedTick: number;
	/** Internal monotonic counter for assigning AnimationFrame.tick. */
	readonly _nextTick: number;
}

export interface CombatStoreActions {
	/**
	 * Initialises a new combat from an already-constructed CombatState.
	 * Calls startCombat (registers handlers, rolls initial intents, begins
	 * player turn) then snapshots the resulting state into the store.
	 */
	initCombat(initialState: CombatState, seed: number): void;

	/**
	 * Plays a card from the player's hand.
	 * Returns immediately if no active combat or the card cannot be played.
	 */
	playCard(
		instanceId: string,
		targetId: string | undefined,
	): { readonly played: boolean; readonly reason?: string };

	/** Ends the current player turn, runs enemy turns, begins the next player turn. */
	endTurn(): void;

	/**
	 * Marks an animation frame as processed.  The frame is removed from the
	 * queue and lastResolvedTick is advanced to max(current, tick).
	 */
	consumeAnimationFrame(tick: number): void;

	/**
	 * Empties the animation queue immediately.
	 * Call this on combat end or emergency fast-forward (e.g. skip animations).
	 */
	clearAnimationQueue(): void;

	/** Tears down the in-memory engine and resets all store state. */
	reset(): void;
}

export type CombatStore = CombatSnapshot & CombatStoreActions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INITIAL_SNAPSHOT: CombatSnapshot = {
	combatState: null,
	phase: "PLAYER_TURN",
	turnNumber: 0,
	animationQueue: [],
	lastResolvedTick: -1,
	_nextTick: 0,
};

/**
 * Infers AnimationFrame.source from the event itself, falling back to `base`.
 * DAMAGE_INTENDED carries `damageSource` which tells us exactly why it fired.
 */
function resolveSource(event: GameEvent, base: ActionSource): ActionSource {
	if (event.type === "DAMAGE_INTENDED") {
		if (event.damageSource === "status") return "status";
		if (event.damageSource === "enemy") return "enemy_intent";
	}
	return base;
}

/**
 * Converts ctx.log entries added since `prevLogLen` into AnimationFrames,
 * assigning monotonically increasing ticks starting at `startTick`.
 * Cancelled events are excluded (they never reached the game state).
 */
function drainNewFrames(
	ctx: CombatContext,
	prevLogLen: number,
	base: ActionSource,
	startTick: number,
): { readonly frames: readonly AnimationFrame[]; readonly nextTick: number } {
	const newEntries = ctx.log.slice(prevLogLen);
	let tick = startTick;
	const frames: AnimationFrame[] = [];
	for (const entry of newEntries) {
		if (!entry.cancelled) {
			frames.push({ tick: tick++, event: entry.event, source: resolveSource(entry.event, base) });
		}
	}
	return { frames, nextTick: tick };
}

/**
 * Shallow-clones the CombatState so that each update produces a new object
 * reference — required for Zustand's shallow-equality renderer to detect
 * changes to nested arrays (statuses, buffs, hand, etc.).
 */
function snapshotCombatState(ctx: CombatContext): CombatState {
	const s = ctx.state;
	return {
		player: {
			...s.player,
			statuses: [...s.player.statuses],
			buffs: [...s.player.buffs],
		},
		enemies: s.enemies.map((e) => ({ ...e, statuses: [...e.statuses], buffs: [...e.buffs] })),
		hand: [...s.hand],
		drawPile: [...s.drawPile],
		discardPile: [...s.discardPile],
		exhaustPile: [...s.exhaustPile],
	};
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCombatStore = create<CombatStore>()((set, get) => ({
	...INITIAL_SNAPSHOT,

	initCombat(initialState, seed) {
		const ctx = new CombatContext(initialState);
		const rng = new Rng(seed);
		const prevLen = ctx.log.length; // 0 before startCombat

		startCombat(ctx, rng);

		_engineCtx = ctx;
		_engineRng = rng;

		const { frames, nextTick } = drainNewFrames(ctx, prevLen, "turn_transition", 0);

		set({
			combatState: snapshotCombatState(ctx),
			phase: ctx.phase,
			turnNumber: ctx.turnNumber,
			animationQueue: frames,
			lastResolvedTick: -1,
			_nextTick: nextTick,
		});
	},

	playCard(instanceId, targetId) {
		const ctx = _engineCtx;
		const rng = _engineRng;
		if (ctx === null || rng === null) {
			return { played: false, reason: "no active combat" };
		}

		const prevLen = ctx.log.length;
		const result = corePlayCard(instanceId, targetId, ctx, rng);

		if (result.played) {
			const { animationQueue, _nextTick } = get();
			const { frames, nextTick } = drainNewFrames(ctx, prevLen, "card", _nextTick);
			set({
				combatState: snapshotCombatState(ctx),
				phase: ctx.phase,
				turnNumber: ctx.turnNumber,
				animationQueue: [...animationQueue, ...frames],
				_nextTick: nextTick,
			});
		}

		return result;
	},

	endTurn() {
		const ctx = _engineCtx;
		const rng = _engineRng;
		if (ctx === null || rng === null) return;

		const prevLen = ctx.log.length;
		endPlayerTurn(ctx, rng);

		const { animationQueue, _nextTick } = get();
		const { frames, nextTick } = drainNewFrames(ctx, prevLen, "turn_transition", _nextTick);
		set({
			combatState: snapshotCombatState(ctx),
			phase: ctx.phase,
			turnNumber: ctx.turnNumber,
			animationQueue: [...animationQueue, ...frames],
			_nextTick: nextTick,
		});
	},

	consumeAnimationFrame(tick) {
		set((state) => ({
			animationQueue: state.animationQueue.filter((f) => f.tick !== tick),
			lastResolvedTick: Math.max(state.lastResolvedTick, tick),
		}));
	},

	clearAnimationQueue() {
		set((state) => ({
			animationQueue: [],
			lastResolvedTick: state._nextTick - 1,
		}));
	},

	reset() {
		_engineCtx = null;
		_engineRng = null;
		set(INITIAL_SNAPSHOT);
	},
}));
