import type { CardInstance } from "@core/cards/card-definition.ts";
import type { CombatState } from "@core/combat/effects/effect-handler.ts";
import {
	applyStatus,
	asCardId,
	asEnemyId,
	asEntityId,
	asStatusId,
	createEnemy,
	createPlayer,
} from "@core/combat/entity.ts";
import { resetSpawnCounter } from "@core/enemies/enemy-registry.ts";
import { beforeEach, describe, expect, it } from "vitest";
import { useCombatStore } from "./useCombatStore.ts";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const PLAYER_ID = asEntityId("player");
const PIDGEY_ID = asEntityId("enemy-0");
const SEED = 42;

function makeDrawPile(): CardInstance[] {
	return [
		{ instanceId: "scratch-0", definitionId: asCardId("scratch"), upgradeLevel: 0 },
		{ instanceId: "scratch-1", definitionId: asCardId("scratch"), upgradeLevel: 0 },
		{ instanceId: "scratch-2", definitionId: asCardId("scratch"), upgradeLevel: 0 },
		{ instanceId: "growl-0", definitionId: asCardId("growl"), upgradeLevel: 0 },
		{ instanceId: "growl-1", definitionId: asCardId("growl"), upgradeLevel: 0 },
	];
}

function makeCombatState(enemyHp = 12): CombatState {
	return {
		player: createPlayer({ id: PLAYER_ID, name: "Charmander", types: ["fire"], maxHp: 44 }),
		enemies: [
			createEnemy({
				id: PIDGEY_ID,
				name: "Pidgey",
				types: ["normal", "flying"],
				maxHp: enemyHp,
				definitionId: asEnemyId("pidgey"),
			}),
		],
		hand: [],
		drawPile: makeDrawPile(),
		discardPile: [],
		exhaustPile: [],
	};
}

// ---------------------------------------------------------------------------
// Helpers that read from the store directly (no React)
// ---------------------------------------------------------------------------

const store = useCombatStore;

beforeEach(() => {
	store.getState().reset();
	resetSpawnCounter();
});

// ---------------------------------------------------------------------------
// initCombat
// ---------------------------------------------------------------------------

describe("initCombat", () => {
	it("sets phase to PLAYER_TURN", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		expect(store.getState().phase).toBe("PLAYER_TURN");
	});

	it("populates combatState (player + enemies visible)", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const { combatState } = store.getState();
		expect(combatState).not.toBeNull();
		expect(combatState?.player.name).toBe("Charmander");
		expect(combatState?.enemies).toHaveLength(1);
	});

	it("draws 5 cards into the hand on the first player turn", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		expect(store.getState().combatState?.hand).toHaveLength(5);
	});

	it("player starts with full energy", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const player = store.getState().combatState?.player;
		expect(player?.energy).toBe(player?.maxEnergy);
	});

	it("Pidgey has a non-unknown intent telegraphed before player acts", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const enemy = store.getState().combatState?.enemies[0];
		expect(enemy?.intent.kind).not.toBe("unknown");
	});

	it("animationQueue has frames from startCombat (COMBAT_START, ENEMY_INTENT_RESOLVED, etc.)", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		expect(store.getState().animationQueue.length).toBeGreaterThan(0);
	});

	it("animation frames have monotonically increasing ticks starting at 0", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const { animationQueue } = store.getState();
		for (let i = 1; i < animationQueue.length; i++) {
			expect(animationQueue[i]?.tick).toBeGreaterThan(animationQueue[i - 1]?.tick ?? -1);
		}
	});

	it("all initCombat frames have source=turn_transition", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		for (const frame of store.getState().animationQueue) {
			expect(frame.source).toBe("turn_transition");
		}
	});

	it("_nextTick equals the number of non-cancelled frames after init", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const { _nextTick, animationQueue } = store.getState();
		expect(_nextTick).toBe(animationQueue.length);
	});

	it("lastResolvedTick starts at -1", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		expect(store.getState().lastResolvedTick).toBe(-1);
	});
});

// ---------------------------------------------------------------------------
// playCard
// ---------------------------------------------------------------------------

describe("playCard", () => {
	it("returns played=false when no active combat", () => {
		const result = store.getState().playCard("scratch-0", undefined);
		expect(result.played).toBe(false);
		expect(result.reason).toBe("no active combat");
	});

	it("returns played=true for a valid scratch card", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const hand = store.getState().combatState?.hand ?? [];
		const scratch = hand.find((c) => c.definitionId === asCardId("scratch"));
		expect(scratch).toBeDefined();

		const result = store.getState().playCard(scratch?.instanceId ?? "", String(PIDGEY_ID));
		expect(result.played).toBe(true);
	});

	it("reduces enemy HP after playing a scratch card (6 damage)", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const hpBefore = store.getState().combatState?.enemies[0]?.hp ?? 0;

		const scratch = store
			.getState()
			.combatState?.hand.find((c) => c.definitionId === asCardId("scratch"));
		store.getState().playCard(scratch?.instanceId ?? "", String(PIDGEY_ID));

		const hpAfter = store.getState().combatState?.enemies[0]?.hp ?? 0;
		expect(hpAfter).toBe(hpBefore - 6);
	});

	it("adds animation frames with source=card after playing", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const queueBefore = store.getState().animationQueue.length;

		const scratch = store
			.getState()
			.combatState?.hand.find((c) => c.definitionId === asCardId("scratch"));
		store.getState().playCard(scratch?.instanceId ?? "", String(PIDGEY_ID));

		const newFrames = store.getState().animationQueue.slice(queueBefore);
		expect(newFrames.length).toBeGreaterThan(0);
		// The CARD_PLAYED / DAMAGE_INTENDED / DAMAGE_DEALT frames should be card-sourced
		const cardFrames = newFrames.filter((f) => f.source === "card");
		expect(cardFrames.length).toBeGreaterThan(0);
	});

	it("sets phase=WIN after killing Pidgey (12 HP, two scratches)", () => {
		store.getState().initCombat(makeCombatState(12), SEED);
		const scratches =
			store.getState().combatState?.hand.filter((c) => c.definitionId === asCardId("scratch")) ??
			[];

		store.getState().playCard(scratches[0]?.instanceId ?? "", String(PIDGEY_ID));
		expect(store.getState().phase).toBe("PLAYER_TURN");

		store.getState().playCard(scratches[1]?.instanceId ?? "", String(PIDGEY_ID));
		expect(store.getState().phase).toBe("WIN");
	});

	it("returns played=false for a card not in hand", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const result = store.getState().playCard("nonexistent-card", String(PIDGEY_ID));
		expect(result.played).toBe(false);
	});

	it("does NOT add animation frames when play fails", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const queueBefore = store.getState().animationQueue.length;
		store.getState().playCard("nonexistent-card", String(PIDGEY_ID));
		expect(store.getState().animationQueue.length).toBe(queueBefore);
	});

	it("enemy DAMAGE_INTENDED frames from card have source=card (not enemy_intent)", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const queueBefore = store.getState().animationQueue.length;

		const scratch = store
			.getState()
			.combatState?.hand.find((c) => c.definitionId === asCardId("scratch"));
		store.getState().playCard(scratch?.instanceId ?? "", String(PIDGEY_ID));

		const newFrames = store.getState().animationQueue.slice(queueBefore);
		const damageFrame = newFrames.find((f) => f.event.type === "DAMAGE_INTENDED");
		expect(damageFrame?.source).toBe("card");
	});
});

// ---------------------------------------------------------------------------
// endTurn
// ---------------------------------------------------------------------------

describe("endTurn", () => {
	it("is a no-op when no active combat", () => {
		expect(() => store.getState().endTurn()).not.toThrow();
		expect(store.getState().combatState).toBeNull();
	});

	it("increments turnNumber after a full cycle", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		expect(store.getState().turnNumber).toBe(0);

		store.getState().endTurn();

		expect(store.getState().turnNumber).toBe(1);
	});

	it("enemy attack reduces player HP during enemy turn", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const hpBefore = store.getState().combatState?.player.hp ?? 44;

		store.getState().endTurn();

		const hpAfter = store.getState().combatState?.player.hp ?? 44;
		expect(hpAfter).toBeLessThan(hpBefore);
	});

	it("phase returns to PLAYER_TURN after enemy turn (combat ongoing)", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		store.getState().endTurn();
		expect(store.getState().phase).toBe("PLAYER_TURN");
	});

	it("adds animation frames with enemy_intent source during enemy attack", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const queueBefore = store.getState().animationQueue.length;

		store.getState().endTurn();

		const newFrames = store.getState().animationQueue.slice(queueBefore);
		expect(newFrames.length).toBeGreaterThan(0);
		// Enemy attack events should be annotated as enemy_intent
		const enemyDamageFrames = newFrames.filter(
			(f) => f.event.type === "DAMAGE_INTENDED" && f.source === "enemy_intent",
		);
		expect(enemyDamageFrames.length).toBeGreaterThan(0);
	});

	it("sets phase=LOSE when player dies during enemy turn", () => {
		const state = makeCombatState();
		state.player.hp = 1; // one hit from death
		store.getState().initCombat(state, SEED);

		// Force a lethal intent (override via the live engine)
		// Pidgey naturally attacks — 1 HP player will die
		store.getState().endTurn();

		// With only 1 HP, any Pidgey attack (min 2 damage per hit) kills the player
		expect(store.getState().phase).toBe("LOSE");
	});
});

// ---------------------------------------------------------------------------
// consumeAnimationFrame
// ---------------------------------------------------------------------------

describe("consumeAnimationFrame", () => {
	it("removes the specified frame from the queue", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const frame = store.getState().animationQueue[0];
		expect(frame).toBeDefined();

		store.getState().consumeAnimationFrame(frame?.tick ?? -1);

		const remaining = store.getState().animationQueue;
		expect(remaining.find((f) => f.tick === frame?.tick)).toBeUndefined();
	});

	it("advances lastResolvedTick to the consumed tick", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const frame = store.getState().animationQueue[0];

		store.getState().consumeAnimationFrame(frame?.tick ?? -1);

		expect(store.getState().lastResolvedTick).toBe(frame?.tick);
	});

	it("lastResolvedTick never goes backwards", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const frames = [...store.getState().animationQueue];

		// Consume out of order: last then first
		if (frames.length >= 2) {
			const last = frames[frames.length - 1];
			const first = frames[0];
			store.getState().consumeAnimationFrame(last?.tick ?? -1);
			const tickAfterLast = store.getState().lastResolvedTick;
			store.getState().consumeAnimationFrame(first?.tick ?? -1);
			expect(store.getState().lastResolvedTick).toBe(tickAfterLast); // unchanged
		}
	});

	it("consuming a non-existent tick is a no-op", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const before = store.getState().animationQueue.length;

		store.getState().consumeAnimationFrame(999999);

		expect(store.getState().animationQueue.length).toBe(before);
	});
});

// ---------------------------------------------------------------------------
// clearAnimationQueue
// ---------------------------------------------------------------------------

describe("clearAnimationQueue", () => {
	it("empties the animation queue", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		expect(store.getState().animationQueue.length).toBeGreaterThan(0);

		store.getState().clearAnimationQueue();

		expect(store.getState().animationQueue).toHaveLength(0);
	});

	it("sets lastResolvedTick to _nextTick - 1", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const { _nextTick } = store.getState();

		store.getState().clearAnimationQueue();

		expect(store.getState().lastResolvedTick).toBe(_nextTick - 1);
	});

	it("new frames appended after clear have ticks after the cleared range", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		store.getState().clearAnimationQueue();

		const { lastResolvedTick } = store.getState();

		const scratch = store
			.getState()
			.combatState?.hand.find((c) => c.definitionId === asCardId("scratch"));
		store.getState().playCard(scratch?.instanceId ?? "", String(PIDGEY_ID));

		for (const frame of store.getState().animationQueue) {
			expect(frame.tick).toBeGreaterThan(lastResolvedTick);
		}
	});
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe("reset", () => {
	it("clears combatState", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		store.getState().reset();
		expect(store.getState().combatState).toBeNull();
	});

	it("clears animation queue", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		store.getState().reset();
		expect(store.getState().animationQueue).toHaveLength(0);
	});

	it("resets turnNumber to 0", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		store.getState().endTurn();
		store.getState().reset();
		expect(store.getState().turnNumber).toBe(0);
	});

	it("playCard after reset returns no active combat", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		store.getState().reset();
		const result = store.getState().playCard("scratch-0", undefined);
		expect(result.played).toBe(false);
		expect(result.reason).toBe("no active combat");
	});
});

// ---------------------------------------------------------------------------
// Animation source annotation
// ---------------------------------------------------------------------------

describe("animation source annotation", () => {
	it("status-sourced DAMAGE_INTENDED gets source=status", () => {
		const state = makeCombatState();
		// Give player Burn so it ticks during beginPlayerTurn
		applyStatus(state.player, { id: asStatusId("burn"), stacks: 2, behavior: "intensity" });

		store.getState().initCombat(state, SEED);

		const burnFrame = store
			.getState()
			.animationQueue.find((f) => f.event.type === "DAMAGE_INTENDED" && f.source === "status");
		expect(burnFrame).toBeDefined();
	});

	it("enemy-sourced DAMAGE_INTENDED gets source=enemy_intent during endTurn", () => {
		store.getState().initCombat(makeCombatState(), SEED);
		const queueBefore = store.getState().animationQueue.length;

		store.getState().endTurn();

		const enemyFrames = store
			.getState()
			.animationQueue.slice(queueBefore)
			.filter((f) => f.event.type === "DAMAGE_INTENDED" && f.source === "enemy_intent");
		expect(enemyFrames.length).toBeGreaterThan(0);
	});

	it("consecutive actions produce strictly increasing tick sequences", () => {
		store.getState().initCombat(makeCombatState(), SEED);

		const scratch = store
			.getState()
			.combatState?.hand.find((c) => c.definitionId === asCardId("scratch"));
		store.getState().playCard(scratch?.instanceId ?? "", String(PIDGEY_ID));

		const allTicks = store.getState().animationQueue.map((f) => f.tick);
		for (let i = 1; i < allTicks.length; i++) {
			expect(allTicks[i]).toBeGreaterThan(allTicks[i - 1] ?? -1);
		}
	});
});
