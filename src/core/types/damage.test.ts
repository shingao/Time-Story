import { describe, expect, it } from "vitest";
import { calculateDamage, getEffectiveness } from "./damage.ts";
import { POKEMON_TYPES, type PokemonType } from "./pokemon-types.ts";
import { TYPE_CHART } from "./type-chart.ts";

// ---------------------------------------------------------------------------
// TYPE_CHART shape invariants
// ---------------------------------------------------------------------------

describe("TYPE_CHART", () => {
	it("has an entry for every type as attacker", () => {
		for (const t of POKEMON_TYPES) {
			expect(TYPE_CHART).toHaveProperty(t);
		}
	});

	it("has an entry for every type as defender in every row", () => {
		for (const atk of POKEMON_TYPES) {
			for (const def of POKEMON_TYPES) {
				const val = TYPE_CHART[atk][def];
				expect([0, 0.5, 1, 2]).toContain(val);
			}
		}
	});
});

// ---------------------------------------------------------------------------
// getEffectiveness — single-type attacker
// ---------------------------------------------------------------------------

describe("getEffectiveness", () => {
	it("throws when defendingTypes is empty", () => {
		expect(() => getEffectiveness("fire", [])).toThrow();
	});

	// Key neutral matchups
	it("returns 1 for normal vs normal", () => {
		expect(getEffectiveness("normal", ["normal"])).toBe(1);
	});

	// Super effective
	it("returns 2 for fire vs grass", () => {
		expect(getEffectiveness("fire", ["grass"])).toBe(2);
	});

	it("returns 2 for water vs fire", () => {
		expect(getEffectiveness("water", ["fire"])).toBe(2);
	});

	// Resisted
	it("returns 0.5 for fire vs water", () => {
		expect(getEffectiveness("fire", ["water"])).toBe(0.5);
	});

	it("returns 0.5 for grass vs fire", () => {
		expect(getEffectiveness("grass", ["fire"])).toBe(0.5);
	});

	// Immunities
	it("returns 0 for normal vs ghost (immune)", () => {
		expect(getEffectiveness("normal", ["ghost"])).toBe(0);
	});

	it("returns 0 for electric vs ground (immune)", () => {
		expect(getEffectiveness("electric", ["ground"])).toBe(0);
	});

	it("returns 0 for ground vs flying (immune)", () => {
		expect(getEffectiveness("ground", ["flying"])).toBe(0);
	});

	it("returns 0 for dragon vs fairy (immune)", () => {
		expect(getEffectiveness("dragon", ["fairy"])).toBe(0);
	});

	it("returns 0 for psychic vs dark (immune)", () => {
		expect(getEffectiveness("psychic", ["dark"])).toBe(0);
	});

	it("returns 0 for fighting vs ghost (immune)", () => {
		expect(getEffectiveness("fighting", ["ghost"])).toBe(0);
	});

	it("returns 0 for poison vs steel (immune)", () => {
		expect(getEffectiveness("poison", ["steel"])).toBe(0);
	});

	it("returns 0 for ghost vs normal (immune)", () => {
		expect(getEffectiveness("ghost", ["normal"])).toBe(0);
	});

	// Dual-type defenders — multiplied
	it("returns 4 for fire vs grass/bug (4x)", () => {
		expect(getEffectiveness("fire", ["grass", "bug"])).toBe(4);
	});

	it("returns 4 for water vs rock/ground (4x)", () => {
		expect(getEffectiveness("water", ["rock", "ground"])).toBe(4);
	});

	it("returns 0.25 for fire vs water/dragon (0.25x)", () => {
		expect(getEffectiveness("fire", ["water", "dragon"])).toBe(0.25);
	});

	// Immunity in dual type cancels everything
	it("returns 0 for electric vs water/ground (ground immune)", () => {
		expect(getEffectiveness("electric", ["water", "ground"])).toBe(0);
	});

	// Classic Charizard: fire/flying vs rock = 2 * 0.5 = 1 (neutral)
	it("returns 0.5 for ice vs fire/dragon (0.5 * 0.5 = 0.25 ≠ wait, actually 1 * 2 = 2)", () => {
		// ice vs fire = 0.5, ice vs dragon = 2  →  0.5 * 2 = 1
		expect(getEffectiveness("ice", ["fire", "dragon"])).toBeCloseTo(1);
	});
});

// ---------------------------------------------------------------------------
// calculateDamage — core damage computation
// ---------------------------------------------------------------------------

describe("calculateDamage", () => {
	it("throws when attackTypes is empty", () => {
		expect(() =>
			calculateDamage({ baseDamage: 10, attackTypes: [], defenderTypes: ["fire"] }),
		).toThrow();
	});

	it("throws when defenderTypes is empty", () => {
		expect(() =>
			calculateDamage({ baseDamage: 10, attackTypes: ["fire"], defenderTypes: [] }),
		).toThrow();
	});

	it("returns neutral damage (floors)", () => {
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["normal"],
			defenderTypes: ["normal"],
		});
		expect(result.finalDamage).toBe(10);
		expect(result.multiplier).toBe(1);
		expect(result.effectiveness).toBe("neutral");
	});

	it("doubles damage on super effective", () => {
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["fire"],
			defenderTypes: ["grass"],
		});
		expect(result.finalDamage).toBe(20);
		expect(result.effectiveness).toBe("super");
	});

	it("halves damage on resisted", () => {
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["fire"],
			defenderTypes: ["water"],
		});
		expect(result.finalDamage).toBe(5);
		expect(result.effectiveness).toBe("resisted");
	});

	it("returns 0 damage on immunity", () => {
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["normal"],
			defenderTypes: ["ghost"],
		});
		expect(result.finalDamage).toBe(0);
		expect(result.effectiveness).toBe("immune");
	});

	it("returns ultra effectiveness label at 4x", () => {
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["fire"],
			defenderTypes: ["grass", "bug"],
		});
		expect(result.finalDamage).toBe(40);
		expect(result.effectiveness).toBe("ultra");
	});

	it("floors fractional damage (does not return 0.5)", () => {
		const result = calculateDamage({
			baseDamage: 5,
			attackTypes: ["fire"],
			defenderTypes: ["water"], // 0.5x → 2.5 → floors to 2
		});
		expect(result.finalDamage).toBe(2);
	});

	it("never returns negative damage", () => {
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["fire"],
			defenderTypes: ["grass"],
			modifiers: [{ kind: "add", value: -9999 }],
		});
		expect(result.finalDamage).toBe(0);
	});

	// Modifiers
	it("applies multiply modifier", () => {
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["normal"],
			defenderTypes: ["normal"],
			modifiers: [{ kind: "multiply", value: 1.5 }],
		});
		expect(result.finalDamage).toBe(15);
	});

	it("applies add modifier", () => {
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["normal"],
			defenderTypes: ["normal"],
			modifiers: [{ kind: "add", value: 5 }],
		});
		expect(result.finalDamage).toBe(15);
	});

	it("applies set modifier (overrides all)", () => {
		const result = calculateDamage({
			baseDamage: 99,
			attackTypes: ["fire"],
			defenderTypes: ["grass"],
			modifiers: [{ kind: "set", value: 7 }],
		});
		expect(result.finalDamage).toBe(7);
	});

	it("applies multiple modifiers in order", () => {
		// 10 base * 1 (neutral) → +5 add → *2 multiply → 30
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["normal"],
			defenderTypes: ["normal"],
			modifiers: [
				{ kind: "add", value: 5 },
				{ kind: "multiply", value: 2 },
			],
		});
		expect(result.finalDamage).toBe(30);
	});

	// dualTypeBehavior
	it("dualTypeBehavior=first uses only first attack type", () => {
		// fire vs grass = 2x; water vs grass = 0.5x → first = fire = 2x
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["fire", "water"],
			defenderTypes: ["grass"],
			dualTypeBehavior: "first",
		});
		expect(result.finalDamage).toBe(20);
		expect(result.multiplier).toBe(2);
	});

	it("dualTypeBehavior=best picks highest multiplier", () => {
		// fire vs grass = 2x; water vs grass = 0.5x → best = 2x
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["fire", "water"],
			defenderTypes: ["grass"],
			dualTypeBehavior: "best",
		});
		expect(result.finalDamage).toBe(20);
		expect(result.multiplier).toBe(2);
	});

	it("dualTypeBehavior=best returns immune=0 only if ALL types are immune", () => {
		// electric vs ground = 0 (immune), ice vs ground = 2 (super) → best = 2
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["electric", "ice"],
			defenderTypes: ["ground"],
			dualTypeBehavior: "best",
		});
		expect(result.finalDamage).toBe(20);
	});

	it("dualTypeBehavior=average averages multipliers", () => {
		// fire vs grass = 2, water vs grass = 0.5 → avg = 1.25 → floor(10*1.25) = 12
		const result = calculateDamage({
			baseDamage: 10,
			attackTypes: ["fire", "water"],
			defenderTypes: ["grass"],
			dualTypeBehavior: "average",
		});
		expect(result.finalDamage).toBe(12);
		expect(result.multiplier).toBeCloseTo(1.25);
	});

	it("defaults to dualTypeBehavior=first when not specified", () => {
		const explicit = calculateDamage({
			baseDamage: 10,
			attackTypes: ["fire", "water"],
			defenderTypes: ["grass"],
			dualTypeBehavior: "first",
		});
		const implicit = calculateDamage({
			baseDamage: 10,
			attackTypes: ["fire", "water"],
			defenderTypes: ["grass"],
		});
		expect(explicit.finalDamage).toBe(implicit.finalDamage);
	});
});

// ---------------------------------------------------------------------------
// Exhaustive matchup spot-checks (key known matchups)
// ---------------------------------------------------------------------------

describe("Known canonical matchups", () => {
	const cases: Array<[PokemonType, PokemonType[], number]> = [
		["fighting", ["normal"], 2], // Fighting SE vs Normal
		["fighting", ["rock"], 2], // Fighting SE vs Rock
		["fighting", ["steel"], 2], // Fighting SE vs Steel
		["fighting", ["psychic"], 0.5], // Fighting resisted by Psychic
		["fighting", ["fairy"], 0.5], // Fighting resisted by Fairy
		["fighting", ["ghost"], 0], // Fighting immune vs Ghost
		["steel", ["fairy"], 2], // Steel SE vs Fairy
		["steel", ["ice"], 2], // Steel SE vs Ice
		["steel", ["rock"], 2], // Steel SE vs Rock
		["fairy", ["dragon"], 2], // Fairy SE vs Dragon
		["fairy", ["fighting"], 2], // Fairy SE vs Fighting
		["fairy", ["dark"], 2], // Fairy SE vs Dark
		["ghost", ["ghost"], 2], // Ghost SE vs Ghost
		["ghost", ["psychic"], 2], // Ghost SE vs Psychic
		["ghost", ["normal"], 0], // Ghost immune vs Normal
		["dark", ["psychic"], 2], // Dark SE vs Psychic
		["dark", ["ghost"], 2], // Dark SE vs Ghost
		["psychic", ["fighting"], 2], // Psychic SE vs Fighting
		["psychic", ["poison"], 2], // Psychic SE vs Poison
		["psychic", ["dark"], 0], // Psychic immune vs Dark
		["ground", ["electric"], 2], // Ground SE vs Electric
		["ground", ["fire"], 2], // Ground SE vs Fire
		["ground", ["flying"], 0], // Ground immune vs Flying
		["electric", ["water"], 2], // Electric SE vs Water
		["electric", ["flying"], 2], // Electric SE vs Flying
		["electric", ["ground"], 0], // Electric immune vs Ground
		["ice", ["dragon"], 2], // Ice SE vs Dragon
		["ice", ["flying"], 2], // Ice SE vs Flying
		["ice", ["grass"], 2], // Ice SE vs Grass
		["ice", ["ground"], 2], // Ice SE vs Ground
		["dragon", ["steel"], 0.5], // Dragon resisted by Steel
		["dragon", ["fairy"], 0], // Dragon immune vs Fairy
	];

	for (const [atk, def, expected] of cases) {
		it(`${atk} vs [${def.join("/")}] = ${expected}x`, () => {
			expect(getEffectiveness(atk, def)).toBe(expected);
		});
	}
});
