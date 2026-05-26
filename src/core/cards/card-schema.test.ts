import { describe, expect, it } from "vitest";
import { parseCardDefinition, safeParseCardDefinition } from "./card-schema.ts";

// ---------------------------------------------------------------------------
// Valid minimal card fixture
// ---------------------------------------------------------------------------

const validCard = {
	id: "scratch",
	name: "Scratch",
	description: "Deal 6 damage.",
	types: ["normal"],
	category: "attack",
	rarity: "starter",
	energyCost: 1,
	target: "enemy",
	effects: [{ kind: "damage", amount: 6 }],
};

// ---------------------------------------------------------------------------
// Happy-path parsing
// ---------------------------------------------------------------------------

describe("parseCardDefinition() — valid cards", () => {
	it("parses a minimal valid card", () => {
		const card = parseCardDefinition(validCard);
		expect(card.name).toBe("Scratch");
		expect(card.energyCost).toBe(1);
	});

	it("brands the id as CardId", () => {
		const card = parseCardDefinition(validCard);
		expect(typeof card.id).toBe("string");
		expect(card.id).toBe("scratch");
	});

	it("parses all effect kinds", () => {
		const withAllEffects = {
			...validCard,
			effects: [
				{ kind: "damage", amount: 8 },
				{ kind: "block", amount: 5 },
				{ kind: "applyStatus", statusId: "burn", behavior: "intensity", stacks: 2 },
				{ kind: "applyBuff", buffId: "strength", stacks: 1 },
				{ kind: "removeStatus", statusId: "burn" },
				{ kind: "heal", amount: 4 },
				{ kind: "drawCards", count: 2 },
				{ kind: "gainEnergy", amount: 1 },
				{ kind: "exhaust" },
			],
		};
		expect(() => parseCardDefinition(withAllEffects)).not.toThrow();
	});

	it("parses damage effect with damageTypes override", () => {
		const card = parseCardDefinition({
			...validCard,
			effects: [{ kind: "damage", amount: 10, damageTypes: ["fire"] }],
		});
		const effect = card.effects[0];
		expect(effect?.kind).toBe("damage");
		if (effect?.kind === "damage") expect(effect.damageTypes).toEqual(["fire"]);
	});

	it("parses scaling on a damage effect", () => {
		const card = parseCardDefinition({
			...validCard,
			effects: [{ kind: "damage", amount: 4, scaling: { source: "strength", factor: 2 } }],
		});
		const effect = card.effects[0];
		if (effect?.kind === "damage") {
			expect(effect.scaling?.source).toBe("strength");
			expect(effect.scaling?.factor).toBe(2);
		}
	});

	it("parses condition on an effect", () => {
		const card = parseCardDefinition({
			...validCard,
			effects: [
				{
					kind: "damage",
					amount: 6,
					condition: { when: "targetHasStatus", statusId: "burn" },
				},
			],
		});
		const effect = card.effects[0];
		if (effect?.kind === "damage") {
			expect(effect.condition?.when).toBe("targetHasStatus");
		}
	});

	it("parses upgradeMap", () => {
		const card = parseCardDefinition({
			...validCard,
			upgradeMap: { name: "Scratch+", effects: [{ kind: "damage", amount: 9 }] },
		});
		expect(card.upgradeMap?.name).toBe("Scratch+");
	});

	it("parses evolvesTo field", () => {
		const card = parseCardDefinition({ ...validCard, evolvesTo: "slash" });
		expect(card.evolvesTo).toBe("slash");
	});

	it("parses tags array", () => {
		const card = parseCardDefinition({ ...validCard, tags: ["fire", "multi-hit"] });
		expect(card.tags).toEqual(["fire", "multi-hit"]);
	});

	it("parses zero energyCost", () => {
		const card = parseCardDefinition({ ...validCard, energyCost: 0 });
		expect(card.energyCost).toBe(0);
	});

	it("parses dual-type card", () => {
		const card = parseCardDefinition({ ...validCard, types: ["fire", "flying"] });
		expect(card.types).toEqual(["fire", "flying"]);
	});

	it("parses all CardCategory values", () => {
		for (const category of ["attack", "skill", "power"] as const) {
			expect(() => parseCardDefinition({ ...validCard, category })).not.toThrow();
		}
	});

	it("parses all CardRarity values", () => {
		for (const rarity of ["starter", "common", "uncommon", "rare"] as const) {
			expect(() => parseCardDefinition({ ...validCard, rarity })).not.toThrow();
		}
	});

	it("parses all CardTarget values", () => {
		for (const target of ["enemy", "allEnemies", "self", "none"] as const) {
			expect(() => parseCardDefinition({ ...validCard, target })).not.toThrow();
		}
	});

	it("parses all condition variants", () => {
		const conditions = [
			{ when: "targetHasStatus", statusId: "burn" },
			{ when: "selfHasBuff", buffId: "strength" },
			{ when: "selfHasBuff", buffId: "rage", minStacks: 3 },
			{ when: "energyAtLeast", amount: 2 },
			{ when: "handSizeAtLeast", count: 4 },
		];
		for (const condition of conditions) {
			expect(() =>
				parseCardDefinition({ ...validCard, effects: [{ kind: "damage", amount: 5, condition }] }),
			).not.toThrow();
		}
	});

	it("parses all scaling sources", () => {
		for (const source of ["strength", "focus", "rage", "energy", "handSize"] as const) {
			expect(() =>
				parseCardDefinition({
					...validCard,
					effects: [{ kind: "damage", amount: 4, scaling: { source, factor: 1 } }],
				}),
			).not.toThrow();
		}
	});
});

// ---------------------------------------------------------------------------
// Validation failures
// ---------------------------------------------------------------------------

describe("parseCardDefinition() — invalid cards throw", () => {
	it("throws on missing id", () => {
		const { id: _, ...noId } = validCard;
		expect(() => parseCardDefinition(noId)).toThrow();
	});

	it("throws on missing name", () => {
		expect(() => parseCardDefinition({ ...validCard, name: "" })).toThrow();
	});

	it("throws on negative energyCost", () => {
		expect(() => parseCardDefinition({ ...validCard, energyCost: -1 })).toThrow();
	});

	it("throws on empty types array", () => {
		expect(() => parseCardDefinition({ ...validCard, types: [] })).toThrow();
	});

	it("throws on invalid type value", () => {
		expect(() => parseCardDefinition({ ...validCard, types: ["notaType"] })).toThrow();
	});

	it("throws on invalid category", () => {
		expect(() => parseCardDefinition({ ...validCard, category: "curse" })).toThrow();
	});

	it("throws on invalid rarity", () => {
		expect(() => parseCardDefinition({ ...validCard, rarity: "legendary" })).toThrow();
	});

	it("throws on invalid target", () => {
		expect(() => parseCardDefinition({ ...validCard, target: "random" })).toThrow();
	});

	it("throws on unknown effect kind", () => {
		expect(() => parseCardDefinition({ ...validCard, effects: [{ kind: "teleport" }] })).toThrow();
	});

	it("throws on negative damage amount", () => {
		expect(() =>
			parseCardDefinition({ ...validCard, effects: [{ kind: "damage", amount: -1 }] }),
		).toThrow();
	});

	it("throws on zero drawCards count", () => {
		expect(() =>
			parseCardDefinition({ ...validCard, effects: [{ kind: "drawCards", count: 0 }] }),
		).toThrow();
	});

	it("throws on zero gainEnergy amount", () => {
		expect(() =>
			parseCardDefinition({ ...validCard, effects: [{ kind: "gainEnergy", amount: 0 }] }),
		).toThrow();
	});

	it("throws on zero stacks in applyStatus", () => {
		expect(() =>
			parseCardDefinition({
				...validCard,
				effects: [{ kind: "applyStatus", statusId: "burn", behavior: "intensity", stacks: 0 }],
			}),
		).toThrow();
	});

	it("throws on invalid behavior in applyStatus", () => {
		expect(() =>
			parseCardDefinition({
				...validCard,
				effects: [{ kind: "applyStatus", statusId: "burn", behavior: "stackable", stacks: 1 }],
			}),
		).toThrow();
	});
});

// ---------------------------------------------------------------------------
// safeParseCardDefinition — non-throwing path
// ---------------------------------------------------------------------------

describe("safeParseCardDefinition()", () => {
	it("returns success:true for valid input", () => {
		const result = safeParseCardDefinition(validCard);
		expect(result.success).toBe(true);
	});

	it("returns success:false for invalid input", () => {
		const result = safeParseCardDefinition({ name: "only a name" });
		expect(result.success).toBe(false);
	});

	it("error includes field path on failure", () => {
		const result = safeParseCardDefinition({ ...validCard, energyCost: -5 });
		expect(result.success).toBe(false);
		if (!result.success) {
			const issues = result.error.issues;
			expect(issues.some((i) => i.path.includes("energyCost"))).toBe(true);
		}
	});
});
