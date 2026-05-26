import { describe, expect, it } from "vitest";
import { parseEnemyDefinition } from "./enemy-schema.ts";

// ---------------------------------------------------------------------------
// Minimal valid definition fixture
// ---------------------------------------------------------------------------

const MINIMAL_PIDGEY = {
	id: "pidgey",
	name: "Pidgey",
	types: ["normal", "flying"],
	hp: { min: 10, max: 13 },
	tier: "normal",
	intents: [
		{ weight: 70, intent: { kind: "attack", damage: 4, hits: 1 } },
		{ weight: 30, intent: { kind: "attack", damage: 2, hits: 2 } },
	],
	aiRules: [{ kind: "no_repeat_in_a_row", maxRepeats: 2 }],
};

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("parseEnemyDefinition — happy path", () => {
	it("parses a minimal attack-only definition without throwing", () => {
		expect(() => parseEnemyDefinition(MINIMAL_PIDGEY)).not.toThrow();
	});

	it("returns a definition with the correct id (branded)", () => {
		const def = parseEnemyDefinition(MINIMAL_PIDGEY);
		expect(String(def.id)).toBe("pidgey");
	});

	it("preserves types array", () => {
		const def = parseEnemyDefinition(MINIMAL_PIDGEY);
		expect(def.types).toEqual(["normal", "flying"]);
	});

	it("preserves hp range", () => {
		const def = parseEnemyDefinition(MINIMAL_PIDGEY);
		expect(def.hp).toEqual({ min: 10, max: 13 });
	});

	it("parses attack intent correctly", () => {
		const def = parseEnemyDefinition(MINIMAL_PIDGEY);
		const first = def.intents[0];
		expect(first?.intent.kind).toBe("attack");
		if (first?.intent.kind === "attack") {
			expect(first.intent.damage).toBe(4);
			expect(first.intent.hits).toBe(1);
		}
	});

	it("parses no_repeat_in_a_row aiRule", () => {
		const def = parseEnemyDefinition(MINIMAL_PIDGEY);
		const rule = def.aiRules?.[0];
		expect(rule?.kind).toBe("no_repeat_in_a_row");
		if (rule?.kind === "no_repeat_in_a_row") {
			expect(rule.maxRepeats).toBe(2);
		}
	});

	it("parses debuff intent with behavior field", () => {
		const raw = {
			...MINIMAL_PIDGEY,
			id: "caterpie",
			intents: [
				{
					weight: 50,
					intent: { kind: "debuff", statusId: "poison", stacks: 2, behavior: "intensity" },
				},
			],
		};
		const def = parseEnemyDefinition(raw);
		const intent = def.intents[0]?.intent;
		expect(intent?.kind).toBe("debuff");
		if (intent?.kind === "debuff") {
			expect(String(intent.statusId)).toBe("poison");
			expect(intent.stacks).toBe(2);
			expect(intent.behavior).toBe("intensity");
		}
	});

	it("parses buff intent", () => {
		const raw = {
			...MINIMAL_PIDGEY,
			id: "mankey",
			intents: [{ weight: 40, intent: { kind: "buff", buffId: "strength", stacks: 2 } }],
		};
		const def = parseEnemyDefinition(raw);
		const intent = def.intents[0]?.intent;
		expect(intent?.kind).toBe("buff");
		if (intent?.kind === "buff") {
			expect(String(intent.buffId)).toBe("strength");
			expect(intent.stacks).toBe(2);
		}
	});

	it("parses defend intent", () => {
		const raw = {
			...MINIMAL_PIDGEY,
			id: "zubat",
			intents: [{ weight: 15, intent: { kind: "defend", block: 4 } }],
		};
		const def = parseEnemyDefinition(raw);
		const intent = def.intents[0]?.intent;
		expect(intent?.kind).toBe("defend");
		if (intent?.kind === "defend") {
			expect(intent.block).toBe(4);
		}
	});

	it("parses intent with appliesStatus", () => {
		const raw = {
			...MINIMAL_PIDGEY,
			id: "zubat-2",
			intents: [
				{
					weight: 25,
					intent: {
						kind: "attack",
						damage: 4,
						hits: 1,
						appliesStatus: { statusId: "poison", stacks: 1, behavior: "intensity" },
					},
				},
			],
		};
		const def = parseEnemyDefinition(raw);
		const intent = def.intents[0]?.intent;
		if (intent?.kind === "attack") {
			expect(intent.appliesStatus).toBeDefined();
			expect(String(intent.appliesStatus?.statusId)).toBe("poison");
		}
	});

	it("parses forced_opener aiRule", () => {
		const raw = {
			...MINIMAL_PIDGEY,
			id: "mankey-2",
			aiRules: [{ kind: "forced_opener", intentIndex: 1 }],
		};
		const def = parseEnemyDefinition(raw);
		const rule = def.aiRules?.[0];
		expect(rule?.kind).toBe("forced_opener");
		if (rule?.kind === "forced_opener") {
			expect(rule.intentIndex).toBe(1);
		}
	});

	it("parses forced_finisher aiRule", () => {
		const raw = {
			...MINIMAL_PIDGEY,
			id: "beedrill",
			aiRules: [{ kind: "forced_finisher", intentIndex: 1, whenHpBelow: 0.3 }],
		};
		const def = parseEnemyDefinition(raw);
		const rule = def.aiRules?.[0];
		expect(rule?.kind).toBe("forced_finisher");
		if (rule?.kind === "forced_finisher") {
			expect(rule.whenHpBelow).toBe(0.3);
		}
	});

	it("parses intent condition hp_below", () => {
		const raw = {
			...MINIMAL_PIDGEY,
			id: "conditional",
			intents: [
				{
					weight: 15,
					intent: { kind: "attack", damage: 10, hits: 1 },
					condition: { kind: "hp_below", threshold: 0.5 },
				},
			],
		};
		const def = parseEnemyDefinition(raw);
		const cond = def.intents[0]?.condition;
		expect(cond?.kind).toBe("hp_below");
		if (cond?.kind === "hp_below") {
			expect(cond.threshold).toBe(0.5);
		}
	});

	it("parses cooldown field on a pattern", () => {
		const raw = {
			...MINIMAL_PIDGEY,
			id: "cooled",
			intents: [{ weight: 50, intent: { kind: "attack", damage: 7, hits: 1 }, cooldown: 3 }],
		};
		const def = parseEnemyDefinition(raw);
		expect(def.intents[0]?.cooldown).toBe(3);
	});

	it("definition without aiRules is valid", () => {
		const raw = { ...MINIMAL_PIDGEY, id: "no-rules" };
		delete (raw as Record<string, unknown>).aiRules;
		expect(() => parseEnemyDefinition(raw)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe("parseEnemyDefinition — validation errors", () => {
	it("throws on missing id", () => {
		const bad = { ...MINIMAL_PIDGEY };
		delete (bad as Record<string, unknown>).id;
		expect(() => parseEnemyDefinition(bad)).toThrow();
	});

	it("throws on empty types array", () => {
		expect(() => parseEnemyDefinition({ ...MINIMAL_PIDGEY, types: [] })).toThrow();
	});

	it("throws on invalid tier", () => {
		expect(() => parseEnemyDefinition({ ...MINIMAL_PIDGEY, tier: "legendary" })).toThrow();
	});

	it("throws on unknown intent kind", () => {
		const bad = {
			...MINIMAL_PIDGEY,
			intents: [{ weight: 100, intent: { kind: "flee" } }],
		};
		expect(() => parseEnemyDefinition(bad)).toThrow();
	});

	it("throws on non-object input", () => {
		expect(() => parseEnemyDefinition(null)).toThrow();
		expect(() => parseEnemyDefinition("pidgey")).toThrow();
		expect(() => parseEnemyDefinition(42)).toThrow();
	});

	it("throws when hp.min > hp.max", () => {
		expect(() => parseEnemyDefinition({ ...MINIMAL_PIDGEY, hp: { min: 20, max: 10 } })).toThrow();
	});

	it("throws when weight is zero or negative", () => {
		const bad = {
			...MINIMAL_PIDGEY,
			intents: [{ weight: 0, intent: { kind: "attack", damage: 4, hits: 1 } }],
		};
		expect(() => parseEnemyDefinition(bad)).toThrow();
	});
});
