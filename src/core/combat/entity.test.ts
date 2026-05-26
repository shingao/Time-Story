import { describe, expect, it } from "vitest";
import {
	applyBuff,
	applyStatus,
	asBuffId,
	asEntityId,
	asStatusId,
	createCombatant,
	createEnemy,
	createPlayer,
	findBuff,
	findStatus,
	gainBlock,
	heal,
	isAlive,
	removeBuff,
	removeStatus,
	takeDamage,
} from "./entity.ts";

// ---------------------------------------------------------------------------
// Branded ID helpers
// ---------------------------------------------------------------------------

describe("branded ID helpers", () => {
	it("asEntityId casts a string to EntityId", () => {
		const id = asEntityId("player-1");
		expect(id).toBe("player-1");
	});

	it("branded types are still strings at runtime", () => {
		expect(typeof asEntityId("x")).toBe("string");
		expect(typeof asBuffId("strength")).toBe("string");
		expect(typeof asStatusId("burn")).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// createCombatant
// ---------------------------------------------------------------------------

describe("createCombatant", () => {
	it("sets hp equal to maxHp", () => {
		const c = createCombatant({
			id: asEntityId("c1"),
			name: "Test",
			types: ["fire"],
			maxHp: 40,
		});
		expect(c.hp).toBe(40);
		expect(c.maxHp).toBe(40);
	});

	it("starts with 0 block", () => {
		const c = createCombatant({ id: asEntityId("c2"), name: "T", types: ["normal"], maxHp: 10 });
		expect(c.block).toBe(0);
	});

	it("starts with empty statuses and buffs", () => {
		const c = createCombatant({ id: asEntityId("c3"), name: "T", types: ["water"], maxHp: 30 });
		expect(c.statuses).toEqual([]);
		expect(c.buffs).toEqual([]);
	});

	it("preserves types array", () => {
		const c = createCombatant({
			id: asEntityId("c4"),
			name: "Dual",
			types: ["fire", "flying"],
			maxHp: 50,
		});
		expect(c.types).toEqual(["fire", "flying"]);
	});
});

// ---------------------------------------------------------------------------
// createPlayer
// ---------------------------------------------------------------------------

describe("createPlayer", () => {
	it("defaults to 3 energy and 3 maxEnergy", () => {
		const p = createPlayer({
			id: asEntityId("p1"),
			name: "Charmander",
			types: ["fire"],
			maxHp: 44,
		});
		expect(p.energy).toBe(3);
		expect(p.maxEnergy).toBe(3);
	});

	it("defaults to 5 drawPerTurn", () => {
		const p = createPlayer({ id: asEntityId("p2"), name: "Treecko", types: ["grass"], maxHp: 40 });
		expect(p.drawPerTurn).toBe(5);
	});

	it("accepts custom maxEnergy", () => {
		const p = createPlayer({
			id: asEntityId("p3"),
			name: "T",
			types: ["normal"],
			maxHp: 30,
			maxEnergy: 4,
		});
		expect(p.maxEnergy).toBe(4);
		expect(p.energy).toBe(4);
	});

	it("accepts custom drawPerTurn", () => {
		const p = createPlayer({
			id: asEntityId("p4"),
			name: "T",
			types: ["normal"],
			maxHp: 30,
			drawPerTurn: 7,
		});
		expect(p.drawPerTurn).toBe(7);
	});

	it("inherits Combatant defaults (block=0, empty statuses)", () => {
		const p = createPlayer({ id: asEntityId("p5"), name: "T", types: ["normal"], maxHp: 50 });
		expect(p.block).toBe(0);
		expect(p.statuses).toEqual([]);
		expect(p.buffs).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// createEnemy
// ---------------------------------------------------------------------------

describe("createEnemy", () => {
	it("starts with intent=unknown", () => {
		const e = createEnemy({
			id: asEntityId("e1"),
			name: "Pidgey",
			types: ["normal", "flying"],
			maxHp: 20,
		});
		expect(e.intent).toEqual({ kind: "unknown" });
	});

	it("has no corrupted field by default", () => {
		const e = createEnemy({ id: asEntityId("e2"), name: "Caterpie", types: ["bug"], maxHp: 15 });
		expect(e.corrupted).toBeUndefined();
	});

	it("stores CorruptionData when provided", () => {
		const e = createEnemy({
			id: asEntityId("e3"),
			name: "Distorted Beedrill",
			types: ["bug", "poison"],
			maxHp: 60,
			corrupted: { intensity: 2, distortionTokens: 3 },
		});
		expect(e.corrupted).toEqual({ intensity: 2, distortionTokens: 3 });
	});

	it("inherits Combatant defaults", () => {
		const e = createEnemy({
			id: asEntityId("e4"),
			name: "Zubat",
			types: ["poison", "flying"],
			maxHp: 25,
		});
		expect(e.hp).toBe(25);
		expect(e.block).toBe(0);
		expect(e.statuses).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

describe("applyStatus / findStatus / removeStatus", () => {
	it("applies a new status", () => {
		const c = createCombatant({ id: asEntityId("s1"), name: "T", types: ["fire"], maxHp: 30 });
		applyStatus(c, { id: asStatusId("burn"), stacks: 2, behavior: "intensity" });
		const s = findStatus(c, asStatusId("burn"));
		expect(s).toBeDefined();
		expect(s?.stacks).toBe(2);
	});

	it("stacks on existing status", () => {
		const c = createCombatant({ id: asEntityId("s2"), name: "T", types: ["fire"], maxHp: 30 });
		applyStatus(c, { id: asStatusId("burn"), stacks: 2, behavior: "intensity" });
		applyStatus(c, { id: asStatusId("burn"), stacks: 1, behavior: "intensity" });
		expect(findStatus(c, asStatusId("burn"))?.stacks).toBe(3);
	});

	it("two different statuses coexist", () => {
		const c = createCombatant({ id: asEntityId("s3"), name: "T", types: ["poison"], maxHp: 30 });
		applyStatus(c, { id: asStatusId("burn"), stacks: 1, behavior: "intensity" });
		applyStatus(c, { id: asStatusId("poison"), stacks: 2, behavior: "intensity" });
		expect(c.statuses).toHaveLength(2);
	});

	it("removeStatus removes it", () => {
		const c = createCombatant({ id: asEntityId("s4"), name: "T", types: ["fire"], maxHp: 30 });
		applyStatus(c, { id: asStatusId("burn"), stacks: 1, behavior: "intensity" });
		removeStatus(c, asStatusId("burn"));
		expect(findStatus(c, asStatusId("burn"))).toBeUndefined();
		expect(c.statuses).toHaveLength(0);
	});

	it("removeStatus on non-existent status is a no-op", () => {
		const c = createCombatant({ id: asEntityId("s5"), name: "T", types: ["fire"], maxHp: 30 });
		expect(() => removeStatus(c, asStatusId("sleep"))).not.toThrow();
	});

	it("applyStatus does not mutate the incoming status object", () => {
		const c = createCombatant({ id: asEntityId("s6"), name: "T", types: ["fire"], maxHp: 30 });
		const incoming = { id: asStatusId("burn"), stacks: 2, behavior: "intensity" as const };
		applyStatus(c, incoming);
		applyStatus(c, incoming); // stack again
		expect(incoming.stacks).toBe(2); // original untouched
		expect(findStatus(c, asStatusId("burn"))?.stacks).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// Buff helpers
// ---------------------------------------------------------------------------

describe("applyBuff / findBuff / removeBuff", () => {
	it("applies a new buff", () => {
		const c = createCombatant({ id: asEntityId("b1"), name: "T", types: ["normal"], maxHp: 40 });
		applyBuff(c, { id: asBuffId("strength"), stacks: 3 });
		expect(findBuff(c, asBuffId("strength"))?.stacks).toBe(3);
	});

	it("stacks on existing buff", () => {
		const c = createCombatant({ id: asEntityId("b2"), name: "T", types: ["normal"], maxHp: 40 });
		applyBuff(c, { id: asBuffId("strength"), stacks: 2 });
		applyBuff(c, { id: asBuffId("strength"), stacks: 2 });
		expect(findBuff(c, asBuffId("strength"))?.stacks).toBe(4);
	});

	it("two different buffs coexist", () => {
		const c = createCombatant({ id: asEntityId("b3"), name: "T", types: ["normal"], maxHp: 40 });
		applyBuff(c, { id: asBuffId("strength"), stacks: 1 });
		applyBuff(c, { id: asBuffId("focus"), stacks: 2 });
		expect(c.buffs).toHaveLength(2);
	});

	it("removeBuff removes it", () => {
		const c = createCombatant({ id: asEntityId("b4"), name: "T", types: ["normal"], maxHp: 40 });
		applyBuff(c, { id: asBuffId("strength"), stacks: 1 });
		removeBuff(c, asBuffId("strength"));
		expect(findBuff(c, asBuffId("strength"))).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Combat helpers: takeDamage, gainBlock, heal, isAlive
// ---------------------------------------------------------------------------

describe("takeDamage", () => {
	it("reduces hp when no block", () => {
		const c = createCombatant({ id: asEntityId("d1"), name: "T", types: ["normal"], maxHp: 40 });
		const dealt = takeDamage(c, 10);
		expect(c.hp).toBe(30);
		expect(dealt).toBe(10);
	});

	it("block absorbs damage before hp", () => {
		const c = createCombatant({ id: asEntityId("d2"), name: "T", types: ["normal"], maxHp: 40 });
		gainBlock(c, 5);
		const dealt = takeDamage(c, 8);
		expect(c.block).toBe(0);
		expect(c.hp).toBe(37); // 40 - (8-5)
		expect(dealt).toBe(3);
	});

	it("block fully absorbs damage", () => {
		const c = createCombatant({ id: asEntityId("d3"), name: "T", types: ["normal"], maxHp: 40 });
		gainBlock(c, 10);
		const dealt = takeDamage(c, 5);
		expect(c.block).toBe(5);
		expect(c.hp).toBe(40); // no HP lost
		expect(dealt).toBe(0);
	});

	it("hp never goes below 0", () => {
		const c = createCombatant({ id: asEntityId("d4"), name: "T", types: ["normal"], maxHp: 10 });
		takeDamage(c, 999);
		expect(c.hp).toBe(0);
	});

	it("block never goes below 0", () => {
		const c = createCombatant({ id: asEntityId("d5"), name: "T", types: ["normal"], maxHp: 40 });
		gainBlock(c, 3);
		takeDamage(c, 10);
		expect(c.block).toBe(0);
	});

	it("0 damage is a no-op", () => {
		const c = createCombatant({ id: asEntityId("d6"), name: "T", types: ["normal"], maxHp: 40 });
		takeDamage(c, 0);
		expect(c.hp).toBe(40);
	});
});

describe("gainBlock", () => {
	it("adds block", () => {
		const c = createCombatant({ id: asEntityId("g1"), name: "T", types: ["normal"], maxHp: 30 });
		gainBlock(c, 7);
		expect(c.block).toBe(7);
	});

	it("stacks block", () => {
		const c = createCombatant({ id: asEntityId("g2"), name: "T", types: ["normal"], maxHp: 30 });
		gainBlock(c, 4);
		gainBlock(c, 3);
		expect(c.block).toBe(7);
	});
});

describe("heal", () => {
	it("restores hp", () => {
		const c = createCombatant({ id: asEntityId("h1"), name: "T", types: ["normal"], maxHp: 40 });
		takeDamage(c, 20);
		heal(c, 10);
		expect(c.hp).toBe(30);
	});

	it("does not exceed maxHp", () => {
		const c = createCombatant({ id: asEntityId("h2"), name: "T", types: ["normal"], maxHp: 40 });
		takeDamage(c, 5);
		heal(c, 999);
		expect(c.hp).toBe(40);
	});

	it("healing a full-hp combatant is a no-op", () => {
		const c = createCombatant({ id: asEntityId("h3"), name: "T", types: ["normal"], maxHp: 40 });
		heal(c, 10);
		expect(c.hp).toBe(40);
	});
});

describe("isAlive", () => {
	it("returns true when hp > 0", () => {
		const c = createCombatant({ id: asEntityId("a1"), name: "T", types: ["normal"], maxHp: 10 });
		expect(isAlive(c)).toBe(true);
	});

	it("returns false when hp = 0", () => {
		const c = createCombatant({ id: asEntityId("a2"), name: "T", types: ["normal"], maxHp: 10 });
		takeDamage(c, 10);
		expect(isAlive(c)).toBe(false);
	});
});
