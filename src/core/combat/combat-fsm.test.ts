/**
 * Golden integration test: full Charmander vs Pidgey combat.
 *
 * This test exercises the entire turn-engine pipeline end-to-end:
 * startCombat → beginPlayerTurn → playCard × N → endPlayerTurn → beginPlayerTurn → WIN
 *
 * No mocks. No React. Pure core/.
 */

import type { CardInstance } from "@core/cards/card-definition.ts";
import { resetSpawnCounter } from "@core/enemies/enemy-registry.ts";
import { Rng } from "@core/rng/rng.ts";
import { beforeEach, describe, expect, it } from "vitest";
import { startCombat } from "./combat-fsm.ts";
import type { CombatState } from "./effects/effect-handler.ts";
import { CombatContext } from "./effects/effect-handler.ts";
import { asCardId, asEnemyId, asEntityId, createEnemy, createPlayer } from "./entity.ts";
import { endPlayerTurn, playCard } from "./turn-engine.ts";

// ---------------------------------------------------------------------------
// Stable seed for deterministic rolls throughout the test suite
// ---------------------------------------------------------------------------

const SEED = 1337;

const PLAYER_ID = asEntityId("player");
const PIDGEY_ID = asEntityId("enemy-0");

// ---------------------------------------------------------------------------
// Helper: build a minimal deterministic draw pile
// Card costs: scratch = 1 energy, 6 damage. Growl = 1 energy, 5 block.
// ---------------------------------------------------------------------------

function makeDrawPile(): CardInstance[] {
	return [
		{ instanceId: "scratch-0", definitionId: asCardId("scratch"), upgradeLevel: 0 },
		{ instanceId: "scratch-1", definitionId: asCardId("scratch"), upgradeLevel: 0 },
		{ instanceId: "scratch-2", definitionId: asCardId("scratch"), upgradeLevel: 0 },
		{ instanceId: "growl-0", definitionId: asCardId("growl"), upgradeLevel: 0 },
		{ instanceId: "growl-1", definitionId: asCardId("growl"), upgradeLevel: 0 },
	];
}

// ---------------------------------------------------------------------------
// Build combat state: Charmander (44 HP, 3 energy) vs Pidgey (12 HP)
// Pidgey has a fixed 12 HP so maths is predictable:
//   scratch × 2 = 12 damage = exactly kills Pidgey.
// ---------------------------------------------------------------------------

function makeState(): CombatState {
	return {
		player: createPlayer({ id: PLAYER_ID, name: "Charmander", types: ["fire"], maxHp: 44 }),
		enemies: [
			createEnemy({
				id: PIDGEY_ID,
				name: "Pidgey",
				types: ["normal", "flying"],
				maxHp: 12,
				definitionId: asEnemyId("pidgey"),
			}),
		],
		hand: [],
		drawPile: makeDrawPile(),
		discardPile: [],
		exhaustPile: [],
	};
}

beforeEach(() => {
	resetSpawnCounter();
});

// ---------------------------------------------------------------------------
// Golden path: Charmander wins in one turn
// ---------------------------------------------------------------------------

describe("Combat FSM — Charmander vs Pidgey (golden integration)", () => {
	it("starts combat in PLAYER_TURN phase", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);

		startCombat(ctx, rng);

		expect(ctx.phase).toBe("PLAYER_TURN");
	});

	it("emits COMBAT_START at the beginning", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);

		startCombat(ctx, rng);

		const ev = ctx.log.find((l) => l.event.type === "COMBAT_START");
		expect(ev).toBeDefined();
	});

	it("rolls initial enemy intent (Pidgey has a known intent before player acts)", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);

		startCombat(ctx, rng);

		const pidgey = ctx.state.enemies[0]!;
		expect(pidgey.intent.kind).not.toBe("unknown");
		expect(pidgey.intent.kind).toBe("attack"); // Pidgey only has attack intents

		const intentEv = ctx.log.find((l) => l.event.type === "ENEMY_INTENT_RESOLVED");
		expect(intentEv).toBeDefined();
	});

	it("draws 5 cards at the start of the first player turn", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);

		startCombat(ctx, rng);

		expect(ctx.state.hand).toHaveLength(5);
	});

	it("player starts with full energy (3/3)", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);

		startCombat(ctx, rng);

		expect(ctx.state.player.energy).toBe(3);
	});

	it("successfully plays a Scratch card", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		const scratchInHand = ctx.state.hand.find((c) => c.definitionId === asCardId("scratch"));
		expect(scratchInHand).toBeDefined();

		const result = playCard(scratchInHand?.instanceId, String(PIDGEY_ID), ctx, rng);

		expect(result.played).toBe(true);
	});

	it("Scratch deals 6 damage to Pidgey", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		const scratch = ctx.state.hand.find((c) => c.definitionId === asCardId("scratch"))!;
		const hpBefore = ctx.state.enemies[0]?.hp;

		playCard(scratch.instanceId, String(PIDGEY_ID), ctx, rng);

		expect(ctx.state.enemies[0]?.hp).toBe(hpBefore - 6);
	});

	it("combat ends in WIN after two Scratches kill Pidgey (12 HP)", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		// Play two scratch cards (each deal 6 damage; Pidgey has 12 HP)
		const scratches = ctx.state.hand.filter((c) => c.definitionId === asCardId("scratch"));
		expect(scratches.length).toBeGreaterThanOrEqual(2);

		playCard(scratches[0]?.instanceId, String(PIDGEY_ID), ctx, rng);
		// After first scratch: Pidgey at 6 HP — combat ongoing
		expect(ctx.phase).toBe("PLAYER_TURN");

		playCard(scratches[1]?.instanceId, String(PIDGEY_ID), ctx, rng);
		// After second scratch: Pidgey at 0 HP — WIN
		expect(ctx.phase).toBe("WIN");
	});

	it("emits COMBAT_END with outcome=victory after killing Pidgey", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		const scratches = ctx.state.hand.filter((c) => c.definitionId === asCardId("scratch"));
		playCard(scratches[0]?.instanceId, String(PIDGEY_ID), ctx, rng);
		playCard(scratches[1]?.instanceId, String(PIDGEY_ID), ctx, rng);

		const endEv = ctx.log.find((l) => l.event.type === "COMBAT_END")?.event;
		expect(endEv?.type).toBe("COMBAT_END");
		if (endEv?.type === "COMBAT_END") {
			expect(endEv.outcome).toBe("victory");
		}
	});

	it("Pidgey deals damage during enemy turn after player ends turn", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		const playerHpBeforeTurnEnd = ctx.state.player.hp;

		// End turn without playing any cards — Pidgey attacks
		endPlayerTurn(ctx, rng);

		// Pidgey's attack should have reduced player HP
		const pidgey = ctx.state.enemies.find((e) => String(e.id) === String(PIDGEY_ID));
		// Either pidgey attacked (hp reduced) or pidgey is still alive
		if (pidgey !== undefined) {
			// Pidgey attack damage is 4 (single hit, 70% weight) or 2×2 (30% weight)
			// With SEED=1337, we get a specific intent. Either way, player takes > 0 dmg.
			expect(ctx.state.player.hp).toBeLessThan(playerHpBeforeTurnEnd);
		}
	});

	it("turn counter increments after each full turn cycle", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		expect(ctx.turnNumber).toBe(0);

		endPlayerTurn(ctx, rng); // full turn: player end → enemy → next player start

		expect(ctx.turnNumber).toBe(1);
	});

	it("player block resets at the start of each player turn", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		// Play a Growl to gain block
		const growl = ctx.state.hand.find((c) => c.definitionId === asCardId("growl"));
		if (growl !== undefined) {
			playCard(growl.instanceId, undefined, ctx, rng);
			expect(ctx.state.player.block).toBeGreaterThan(0);
		}

		// End turn → enemy turn → new player turn start → block resets
		endPlayerTurn(ctx, rng);

		// Block should be 0 at the start of the new player turn
		// (unless Pidgey gave us block, which it doesn't)
		expect(ctx.state.player.block).toBe(0);
	});

	it("full two-turn victory: surviving Pidgey's turn then killing on turn 2", () => {
		// Give Pidgey fewer HP so it dies on turn 2
		// Charmander has 3 energy → can play 3 scratches/turn (18 dmg)
		// But let's survive turn 1 with just Growl, then kill on turn 2
		const state = makeState();
		state.enemies[0]!.hp = 8; // will die on first scratch next turn
		const ctx = new CombatContext(state);
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		// Turn 1: play only Growl (block, no damage)
		const growl = ctx.state.hand.find((c) => c.definitionId === asCardId("growl"));
		if (growl !== undefined) {
			playCard(growl.instanceId, undefined, ctx, rng);
		}
		endPlayerTurn(ctx, rng); // Pidgey attacks, new player turn starts

		expect(ctx.turnNumber).toBe(1);
		expect(ctx.phase).toBe("PLAYER_TURN");

		// Turn 2: play Scratch to finish Pidgey (hp <= 8, scratch = 6, may need 2)
		const hand2 = ctx.state.hand;
		const scratches2 = hand2.filter((c) => c.definitionId === asCardId("scratch"));
		expect(scratches2.length).toBeGreaterThan(0);

		for (const s of scratches2) {
			if (ctx.phase !== "PLAYER_TURN") break;
			const pidgeyAlive = ctx.state.enemies.some((e) => e.hp > 0);
			if (!pidgeyAlive) break;
			playCard(s.instanceId, String(PIDGEY_ID), ctx, rng);
		}

		expect(ctx.phase).toBe("WIN");
	});
});

// ---------------------------------------------------------------------------
// Multi-enemy design: N-enemy loop works correctly
// ---------------------------------------------------------------------------

describe("Combat FSM — multi-enemy design", () => {
	it("handles two enemies: both get turn actions, order preserved", () => {
		const pidgey2Id = asEntityId("enemy-1");
		const state: CombatState = {
			player: createPlayer({ id: PLAYER_ID, name: "Charmander", types: ["fire"], maxHp: 44 }),
			enemies: [
				createEnemy({
					id: PIDGEY_ID,
					name: "Pidgey",
					types: ["normal", "flying"],
					maxHp: 12,
					definitionId: asEnemyId("pidgey"),
				}),
				createEnemy({
					id: pidgey2Id,
					name: "Pidgey 2",
					types: ["normal", "flying"],
					maxHp: 12,
					definitionId: asEnemyId("pidgey"),
				}),
			],
			hand: [],
			drawPile: makeDrawPile(),
			discardPile: [],
			exhaustPile: [],
		};

		const ctx = new CombatContext(state);
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		// Both enemies should have intents resolved before player acts
		const intentEvents = ctx.log.filter((l) => l.event.type === "ENEMY_INTENT_RESOLVED");
		expect(intentEvents).toHaveLength(2);

		// Both enemies' intents should be non-unknown
		for (const enemy of ctx.state.enemies) {
			expect(enemy.intent.kind).not.toBe("unknown");
		}
	});

	it("WIN only triggers when ALL enemies are dead, not just one", () => {
		const pidgey2Id = asEntityId("enemy-1");
		const state: CombatState = {
			player: createPlayer({ id: PLAYER_ID, name: "Charmander", types: ["fire"], maxHp: 44 }),
			enemies: [
				createEnemy({
					id: PIDGEY_ID,
					name: "Pidgey A",
					types: ["normal", "flying"],
					maxHp: 6, // one scratch kills it
					definitionId: asEnemyId("pidgey"),
				}),
				createEnemy({
					id: pidgey2Id,
					name: "Pidgey B",
					types: ["normal", "flying"],
					maxHp: 30, // survives
					definitionId: asEnemyId("pidgey"),
				}),
			],
			hand: [],
			drawPile: makeDrawPile(),
			discardPile: [],
			exhaustPile: [],
		};

		const ctx = new CombatContext(state);
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		// Kill only the first enemy
		const scratch = ctx.state.hand.find((c) => c.definitionId === asCardId("scratch"))!;
		playCard(scratch.instanceId, String(PIDGEY_ID), ctx, rng);

		// First Pidgey dead, but second still alive — should NOT be WIN
		expect(ctx.phase).toBe("PLAYER_TURN");
		expect(ctx.state.enemies.some((e) => e.hp > 0)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// LOSE condition
// ---------------------------------------------------------------------------

describe("Combat FSM — LOSE condition", () => {
	it("sets phase to LOSE when player dies from enemy attack", () => {
		const state = makeState();
		state.player.hp = 1; // one hit from death
		const ctx = new CombatContext(state);
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		// Pidgey's minimum attack is 2 damage (2×2 or 4×1) — kills player at 1 HP
		ctx.state.enemies[0]!.intent = { kind: "attack", damage: 10, hits: 1 };
		endPlayerTurn(ctx, rng);

		expect(ctx.phase).toBe("LOSE");
	});

	it("emits COMBAT_END with outcome=defeat when player dies", () => {
		const state = makeState();
		state.player.hp = 1;
		const ctx = new CombatContext(state);
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		ctx.state.enemies[0]!.intent = { kind: "attack", damage: 10, hits: 1 };
		endPlayerTurn(ctx, rng);

		const endEv = ctx.log.find((l) => l.event.type === "COMBAT_END")?.event;
		expect(endEv?.type).toBe("COMBAT_END");
		if (endEv?.type === "COMBAT_END") {
			expect(endEv.outcome).toBe("defeat");
		}
	});
});

// ---------------------------------------------------------------------------
// Block-reset default handler integration
// ---------------------------------------------------------------------------

describe("Combat FSM — block-reset default handler", () => {
	it("player block gained from Growl is zeroed at next player turn start", () => {
		const ctx = new CombatContext(makeState());
		const rng = new Rng(SEED);
		startCombat(ctx, rng);

		const growl = ctx.state.hand.find((c) => c.definitionId === asCardId("growl"))!;
		playCard(growl.instanceId, undefined, ctx, rng);

		const blockAfterGrowl = ctx.state.player.block;
		expect(blockAfterGrowl).toBeGreaterThan(0); // 5 block from Growl

		endPlayerTurn(ctx, rng); // → enemy turn → new player turn (block reset fires)

		expect(ctx.state.player.block).toBe(0);
	});
});
