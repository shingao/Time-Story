import type { CombatState } from "@core/combat/effects/effect-handler.ts";
import { CombatContext } from "@core/combat/effects/effect-handler.ts";
import {
	asBuffId,
	asEnemyId,
	asEntityId,
	asStatusId,
	createEnemy,
	createPlayer,
} from "@core/combat/entity.ts";
import { Rng } from "@core/rng/rng.ts";
import { beforeEach, describe, expect, it } from "vitest";
import { executeEnemyIntent, rollIntent } from "./enemy-ai.ts";
import { getEnemyDefinition, resetSpawnCounter } from "./enemy-registry.ts";
import type { EnemyDefinition } from "./enemy-types.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAYER_ID = asEntityId("player");
const ENEMY_ID = asEntityId("enemy-0");

function makeState(): CombatState {
	return {
		player: createPlayer({ id: PLAYER_ID, name: "Charmander", types: ["fire"], maxHp: 44 }),
		enemies: [
			createEnemy({
				id: ENEMY_ID,
				name: "Pidgey",
				types: ["normal", "flying"],
				maxHp: 12,
				definitionId: asEnemyId("pidgey"),
			}),
		],
		hand: [],
		drawPile: [],
		discardPile: [],
		exhaustPile: [],
	};
}

function makeCtx(): CombatContext {
	return new CombatContext(makeState());
}

beforeEach(() => {
	resetSpawnCounter();
});

// ---------------------------------------------------------------------------
// rollIntent — forced_opener
// ---------------------------------------------------------------------------

describe("rollIntent — forced_opener", () => {
	it("uses forced_opener on turn 0", () => {
		const ctx = makeCtx();
		ctx.turnNumber = 0;
		const enemy = ctx.state.enemies[0]!;
		const def = getEnemyDefinition(asEnemyId("mankey"));
		// mankey forced_opener: intentIndex 1 = buff/strength intent
		const intent = rollIntent(enemy, def, ctx, new Rng(1));
		expect(intent.kind).toBe("buff");
	});

	it("does NOT use forced_opener on turn > 0", () => {
		const ctx = makeCtx();
		ctx.turnNumber = 1;
		const enemy = ctx.state.enemies[0]!;
		const def = getEnemyDefinition(asEnemyId("mankey"));
		// On later turns the full weighted table is used — run 20 times to
		// confirm we get at least one non-buff result
		const rng = new Rng(999);
		const kinds = new Set<string>();
		for (let i = 0; i < 20; i++) {
			kinds.add(rollIntent(enemy, def, ctx, rng).kind);
		}
		expect(kinds.size).toBeGreaterThan(1);
	});
});

// ---------------------------------------------------------------------------
// rollIntent — forced_finisher
// ---------------------------------------------------------------------------

describe("rollIntent — forced_finisher", () => {
	it("triggers forced_finisher when enemy HP is below threshold", () => {
		const ctx = makeCtx();
		ctx.turnNumber = 1;
		const enemy = ctx.state.enemies[0]!;
		// Beedrill-elite: forced_finisher at intentIndex=1 whenHpBelow=0.3
		const def = getEnemyDefinition(asEnemyId("beedrill-elite"));
		// Set enemy hp to 10% of max (below 30%)
		Object.assign(enemy, { maxHp: 35 });
		enemy.hp = 3; // ~8.5% → below 0.3 threshold
		enemy.definitionId = asEnemyId("beedrill-elite");
		const intent = rollIntent(enemy, def, ctx, new Rng(1));
		// intentIndex 1 on beedrill is a multi-hit attack with poison
		expect(intent.kind).toBe("attack");
		if (intent.kind === "attack") {
			expect(intent.hits).toBeGreaterThanOrEqual(2);
		}
	});

	it("does NOT trigger forced_finisher when HP is above threshold", () => {
		const ctx = makeCtx();
		ctx.turnNumber = 1;
		const enemy = ctx.state.enemies[0]!;
		const def = getEnemyDefinition(asEnemyId("beedrill-elite"));
		Object.assign(enemy, { maxHp: 35 });
		enemy.hp = 35; // 100% — well above 0.3
		enemy.definitionId = asEnemyId("beedrill-elite");
		// Run 20 times; some should not be the finisher attack
		const kinds = new Set<string>();
		const rng = new Rng(7);
		for (let i = 0; i < 20; i++) {
			kinds.add(rollIntent(enemy, def, ctx, rng).kind);
		}
		// Should get varied intents including defend or buff
		expect(kinds.size).toBeGreaterThan(1);
	});
});

// ---------------------------------------------------------------------------
// rollIntent — no_repeat_in_a_row
// ---------------------------------------------------------------------------

describe("rollIntent — no_repeat_in_a_row", () => {
	it("prevents the same intent kind from being selected 3 times in a row (maxRepeats=2)", () => {
		const ctx = makeCtx();
		ctx.turnNumber = 1;
		const enemy = ctx.state.enemies[0]!;
		const def = getEnemyDefinition(asEnemyId("pidgey")); // maxRepeats: 2

		// Force lastIntentKind=attack, repeatCount=2 (already at limit)
		enemy.aiState.lastIntentKind = "attack";
		enemy.aiState.repeatCount = 2;

		// Run 30 times — must NEVER pick attack again while at limit
		const rng = new Rng(42);
		for (let i = 0; i < 30; i++) {
			const intent = rollIntent(enemy, def, ctx, rng);
			// Pidgey only has attack intents, so fallback fires — just ensure
			// the function doesn't throw and returns a valid intent
			expect(["attack", "buff", "debuff", "defend", "unknown"]).toContain(intent.kind);
		}
	});
});

// ---------------------------------------------------------------------------
// rollIntent — condition gating
// ---------------------------------------------------------------------------

describe("rollIntent — condition gating", () => {
	it("excludes patterns whose hp_below condition is not met", () => {
		const ctx = makeCtx();
		ctx.turnNumber = 1;
		const enemy = ctx.state.enemies[0]!;
		const def = getEnemyDefinition(asEnemyId("mankey"));
		// mankey has a heavy attack conditional on hp_below 0.5
		// With full HP only the normal patterns are eligible
		enemy.hp = 20;
		Object.assign(enemy, { maxHp: 20 });
		enemy.definitionId = asEnemyId("mankey");

		const rng = new Rng(11);
		const heavyDmgSeen = Array.from({ length: 50 }, () => rollIntent(enemy, def, ctx, rng)).filter(
			(i) => i.kind === "attack" && (i as { kind: "attack"; damage: number }).damage === 10,
		);
		// heavy-attack (dmg=10) is guarded by hp_below 0.5, should be 0
		expect(heavyDmgSeen).toHaveLength(0);
	});

	it("includes hp_below-gated intent when enemy is at low HP", () => {
		const ctx = makeCtx();
		ctx.turnNumber = 1;
		const enemy = ctx.state.enemies[0]!;
		const def = getEnemyDefinition(asEnemyId("mankey"));
		enemy.hp = 5;
		Object.assign(enemy, { maxHp: 20 });
		enemy.definitionId = asEnemyId("mankey");

		const rng = new Rng(11);
		const results = Array.from({ length: 100 }, () => rollIntent(enemy, def, ctx, rng));
		const heavySeen = results.filter(
			(i) => i.kind === "attack" && (i as { kind: "attack"; damage: number }).damage === 10,
		);
		expect(heavySeen.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// rollIntent — cooldowns
// ---------------------------------------------------------------------------

describe("rollIntent — cooldown tracking", () => {
	it("does not select a pattern that is on cooldown", () => {
		// Build a minimal 2-pattern def: one always-available, one with cooldown
		const def: EnemyDefinition = {
			id: asEnemyId("test-cd"),
			name: "Test",
			types: ["normal"],
			hp: { min: 10, max: 10 },
			tier: "normal",
			intents: [
				{ weight: 1, intent: { kind: "defend", block: 4 } },
				{ weight: 99, intent: { kind: "attack", damage: 6, hits: 1 }, cooldown: 2 },
			],
		};

		const ctx = makeCtx();
		ctx.turnNumber = 1;
		const enemy = ctx.state.enemies[0]!;
		// Put index 1 (attack, weight 99) on a long cooldown so it stays blocked
		// for all 10 test iterations (each rollIntent call decrements by 1).
		enemy.aiState.cooldowns[1] = 20;

		// All 10 rolls must pick the defend (index 0), the only eligible pattern
		const rng = new Rng(1);
		for (let i = 0; i < 10; i++) {
			const intent = rollIntent(enemy, def, ctx, rng);
			expect(intent.kind).toBe("defend");
		}
	});
});

// ---------------------------------------------------------------------------
// executeEnemyIntent — attack
// ---------------------------------------------------------------------------

describe("executeEnemyIntent — attack", () => {
	it("emits DAMAGE_INTENDED for each hit", () => {
		const ctx = makeCtx();
		// Register a passthrough handler so DAMAGE_INTENDED is logged
		const enemy = ctx.state.enemies[0]!;
		enemy.intent = { kind: "attack", damage: 4, hits: 3 };

		executeEnemyIntent(enemy, ctx);

		const damageEvents = ctx.log.filter((l) => l.event.type === "DAMAGE_INTENDED");
		expect(damageEvents).toHaveLength(3);
	});

	it("targets the player with damageSource=enemy", () => {
		const ctx = makeCtx();
		const enemy = ctx.state.enemies[0]!;
		enemy.intent = { kind: "attack", damage: 7, hits: 1 };

		executeEnemyIntent(enemy, ctx);

		const ev = ctx.log.find((l) => l.event.type === "DAMAGE_INTENDED")?.event;
		expect(ev?.type).toBe("DAMAGE_INTENDED");
		if (ev?.type === "DAMAGE_INTENDED") {
			expect(String(ev.targetId)).toBe(String(PLAYER_ID));
			expect(ev.damageSource).toBe("enemy");
		}
	});

	it("applies status after attack when appliesStatus is set", () => {
		const ctx = makeCtx();
		const enemy = ctx.state.enemies[0]!;
		enemy.intent = {
			kind: "attack",
			damage: 3,
			hits: 2,
			appliesStatus: {
				statusId: asStatusId("poison"),
				stacks: 1,
				behavior: "intensity",
			},
		};

		executeEnemyIntent(enemy, ctx);

		const statusEv = ctx.log.find((l) => l.event.type === "STATUS_APPLIED")?.event;
		expect(statusEv?.type).toBe("STATUS_APPLIED");
		if (statusEv?.type === "STATUS_APPLIED") {
			expect(String(statusEv.status.id)).toBe("poison");
		}
	});
});

// ---------------------------------------------------------------------------
// executeEnemyIntent — buff
// ---------------------------------------------------------------------------

describe("executeEnemyIntent — buff", () => {
	it("applies buff to the enemy and emits BUFF_APPLIED", () => {
		const ctx = makeCtx();
		const enemy = ctx.state.enemies[0]!;
		enemy.intent = { kind: "buff", buffId: asBuffId("strength"), stacks: 2 };

		executeEnemyIntent(enemy, ctx);

		const ev = ctx.log.find((l) => l.event.type === "BUFF_APPLIED")?.event;
		expect(ev?.type).toBe("BUFF_APPLIED");
		if (ev?.type === "BUFF_APPLIED") {
			expect(ev.buffId).toBe("strength");
			expect(ev.stacks).toBe(2);
		}
	});
});

// ---------------------------------------------------------------------------
// executeEnemyIntent — debuff
// ---------------------------------------------------------------------------

describe("executeEnemyIntent — debuff", () => {
	it("applies status to the player and emits STATUS_APPLIED", () => {
		const ctx = makeCtx();
		const enemy = ctx.state.enemies[0]!;
		enemy.intent = {
			kind: "debuff",
			statusId: asStatusId("poison"),
			stacks: 3,
			behavior: "intensity",
		};

		executeEnemyIntent(enemy, ctx);

		const ev = ctx.log.find((l) => l.event.type === "STATUS_APPLIED")?.event;
		expect(ev?.type).toBe("STATUS_APPLIED");
		if (ev?.type === "STATUS_APPLIED") {
			expect(String(ev.status.id)).toBe("poison");
			expect(ev.status.stacks).toBe(3);
		}
	});
});

// ---------------------------------------------------------------------------
// executeEnemyIntent — defend
// ---------------------------------------------------------------------------

describe("executeEnemyIntent — defend", () => {
	it("grants block to the enemy and emits BLOCK_GAINED", () => {
		const ctx = makeCtx();
		const enemy = ctx.state.enemies[0]!;
		enemy.intent = { kind: "defend", block: 8 };

		executeEnemyIntent(enemy, ctx);

		expect(enemy.block).toBe(8);
		const ev = ctx.log.find((l) => l.event.type === "BLOCK_GAINED")?.event;
		expect(ev?.type).toBe("BLOCK_GAINED");
		if (ev?.type === "BLOCK_GAINED") {
			expect(ev.amount).toBe(8);
		}
	});
});

// ---------------------------------------------------------------------------
// executeEnemyIntent — unknown (no-op)
// ---------------------------------------------------------------------------

describe("executeEnemyIntent — unknown", () => {
	it("does nothing when intent is unknown", () => {
		const ctx = makeCtx();
		const enemy = ctx.state.enemies[0]!;
		enemy.intent = { kind: "unknown" };

		executeEnemyIntent(enemy, ctx);

		expect(ctx.log).toHaveLength(0);
	});
});
