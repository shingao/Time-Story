import { asCardId, asStatusId } from "@core/combat/entity.ts";
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "./card-definition.ts";
import { resolveCard } from "./card-definition.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScratch(): CardDefinition {
	return {
		id: asCardId("scratch"),
		name: "Scratch",
		description: "Deal 6 damage.",
		types: ["normal"],
		category: "attack",
		rarity: "starter",
		energyCost: 1,
		target: "enemy",
		effects: [{ kind: "damage", amount: 6 }],
	};
}

function makeGrowl(): CardDefinition {
	return {
		id: asCardId("growl"),
		name: "Growl",
		description: "Gain 5 block.",
		types: ["normal"],
		category: "skill",
		rarity: "starter",
		energyCost: 1,
		target: "self",
		effects: [{ kind: "block", amount: 5 }],
		upgradeMap: {
			name: "Growl+",
			description: "Gain 8 block.",
			energyCost: 1,
			effects: [{ kind: "block", amount: 8 }],
		},
	};
}

function makeEmber(): CardDefinition {
	return {
		id: asCardId("ember"),
		name: "Ember",
		description: "Deal 7 fire damage. Apply 1 Burn.",
		types: ["fire"],
		category: "attack",
		rarity: "common",
		energyCost: 1,
		target: "enemy",
		effects: [
			{ kind: "damage", amount: 7 },
			{ kind: "applyStatus", statusId: asStatusId("burn"), behavior: "intensity", stacks: 1 },
		],
		upgradeMap: {
			description: "Deal 10 fire damage. Apply 1 Burn.",
			effects: [
				{ kind: "damage", amount: 10 },
				{ kind: "applyStatus", statusId: asStatusId("burn"), behavior: "intensity", stacks: 1 },
			],
		},
	};
}

// ---------------------------------------------------------------------------
// resolveCard — level 0 (no upgrade)
// ---------------------------------------------------------------------------

describe("resolveCard() at level 0", () => {
	it("returns upgradeLevel 0 on base card", () => {
		const def = makeScratch();
		const resolved = resolveCard(def, 0);
		expect(resolved.upgradeLevel).toBe(0);
	});

	it("preserves all fields at level 0", () => {
		const def = makeScratch();
		const resolved = resolveCard(def, 0);
		expect(resolved.id).toBe(def.id);
		expect(resolved.name).toBe("Scratch");
		expect(resolved.energyCost).toBe(1);
		expect(resolved.effects).toHaveLength(1);
	});

	it("does not apply upgradeMap at level 0", () => {
		const def = makeGrowl();
		const resolved = resolveCard(def, 0);
		expect(resolved.name).toBe("Growl");
		const effect = resolved.effects[0];
		expect(effect?.kind).toBe("block");
		if (effect?.kind === "block") expect(effect.amount).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// resolveCard — level 1 (with upgrade)
// ---------------------------------------------------------------------------

describe("resolveCard() at level 1", () => {
	it("sets upgradeLevel 1", () => {
		const def = makeGrowl();
		expect(resolveCard(def, 1).upgradeLevel).toBe(1);
	});

	it("applies upgradeMap name override", () => {
		const def = makeGrowl();
		expect(resolveCard(def, 1).name).toBe("Growl+");
	});

	it("applies upgradeMap energyCost override", () => {
		const base = makeGrowl();
		const withCostDrop = { ...base, upgradeMap: { energyCost: 0 } };
		expect(resolveCard(withCostDrop, 1).energyCost).toBe(0);
	});

	it("applies upgradeMap effects override", () => {
		const def = makeGrowl();
		const resolved = resolveCard(def, 1);
		const effect = resolved.effects[0];
		expect(effect?.kind).toBe("block");
		if (effect?.kind === "block") expect(effect.amount).toBe(8);
	});

	it("falls back to original fields not in upgradeMap", () => {
		// upgradeMap on Growl does not override 'category' or 'rarity'
		const def = makeGrowl();
		const resolved = resolveCard(def, 1);
		expect(resolved.category).toBe("skill");
		expect(resolved.rarity).toBe("starter");
	});

	it("multi-effect card upgrade replaces entire effects array", () => {
		const def = makeEmber();
		const resolved = resolveCard(def, 1);
		expect(resolved.effects).toHaveLength(2);
		const dmgEffect = resolved.effects[0];
		expect(dmgEffect?.kind).toBe("damage");
		if (dmgEffect?.kind === "damage") expect(dmgEffect.amount).toBe(10);
	});

	it("card without upgradeMap at level 1 returns original definition", () => {
		const def = makeScratch(); // no upgradeMap
		const resolved = resolveCard(def, 1);
		expect(resolved.upgradeLevel).toBe(1);
		expect(resolved.name).toBe("Scratch");
		const effect = resolved.effects[0];
		if (effect?.kind === "damage") expect(effect.amount).toBe(6);
	});
});

// ---------------------------------------------------------------------------
// resolveCard — level 2
// ---------------------------------------------------------------------------

describe("resolveCard() at level 2", () => {
	it("sets upgradeLevel 2", () => {
		expect(resolveCard(makeGrowl(), 2).upgradeLevel).toBe(2);
	});

	it("still applies upgradeMap at level 2 (same as level 1)", () => {
		const def = makeGrowl();
		expect(resolveCard(def, 2).name).toBe("Growl+");
	});
});

// ---------------------------------------------------------------------------
// resolveCard — immutability
// ---------------------------------------------------------------------------

describe("resolveCard() immutability", () => {
	it("does not mutate the original definition", () => {
		const def = makeGrowl();
		resolveCard(def, 1);
		expect(def.name).toBe("Growl"); // original unchanged
	});

	it("returns a new object at every call", () => {
		const def = makeScratch();
		const a = resolveCard(def, 0);
		const b = resolveCard(def, 0);
		expect(a).not.toBe(b);
	});
});

// ---------------------------------------------------------------------------
// CardDefinition structural invariants
// ---------------------------------------------------------------------------

describe("CardDefinition structural invariants", () => {
	it("scaling on a damage effect is preserved through resolveCard", () => {
		const def: CardDefinition = {
			id: asCardId("claw"),
			name: "Claw",
			description: "Deal 4 + Rage damage.",
			types: ["normal"],
			category: "attack",
			rarity: "common",
			energyCost: 1,
			target: "enemy",
			effects: [{ kind: "damage", amount: 4, scaling: { source: "rage", factor: 1 } }],
		};
		const resolved = resolveCard(def, 0);
		const effect = resolved.effects[0];
		expect(effect?.kind).toBe("damage");
		if (effect?.kind === "damage") {
			expect(effect.scaling?.source).toBe("rage");
			expect(effect.scaling?.factor).toBe(1);
		}
	});

	it("condition on a damage effect is preserved through resolveCard", () => {
		const def: CardDefinition = {
			id: asCardId("scorch"),
			name: "Scorch",
			description: "Deal 6 extra damage if target is burning.",
			types: ["fire"],
			category: "attack",
			rarity: "uncommon",
			energyCost: 0,
			target: "enemy",
			effects: [
				{
					kind: "damage",
					amount: 6,
					condition: { when: "targetHasStatus", statusId: asStatusId("burn") },
				},
			],
		};
		const effect = resolveCard(def, 0).effects[0];
		expect(effect?.kind).toBe("damage");
		if (effect?.kind === "damage") {
			expect(effect.condition?.when).toBe("targetHasStatus");
		}
	});

	it("zero-cost cards are valid", () => {
		const def: CardDefinition = {
			id: asCardId("free-draw"),
			name: "Free Draw",
			description: "Draw 2 cards.",
			types: ["normal"],
			category: "skill",
			rarity: "common",
			energyCost: 0,
			target: "none",
			effects: [{ kind: "drawCards", count: 2 }],
		};
		expect(resolveCard(def, 0).energyCost).toBe(0);
	});

	it("dual-type card preserves both types", () => {
		const def: CardDefinition = {
			id: asCardId("bubblebeam"),
			name: "Bubblebeam",
			description: "Deal 9 water damage.",
			types: ["water", "normal"],
			category: "attack",
			rarity: "common",
			energyCost: 2,
			target: "enemy",
			effects: [{ kind: "damage", amount: 9 }],
		};
		expect(resolveCard(def, 0).types).toEqual(["water", "normal"]);
	});
});
