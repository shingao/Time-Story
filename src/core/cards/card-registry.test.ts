import { Rng } from "@core/rng/rng.ts";
import charmanderRaw from "@data/cards/charmander.json";
import treeckoRaw from "@data/cards/treecko.json";
import { describe, expect, it } from "vitest";
import { resolveCard } from "./card-definition.ts";
import {
	CARD_REGISTRY,
	createStarterDeck,
	getCardDefinition,
	getStarterPool,
} from "./card-registry.ts";
import { parseCardDefinition } from "./card-schema.ts";

// ---------------------------------------------------------------------------
// JSON file integrity — every card in every JSON file must parse
// ---------------------------------------------------------------------------

describe("charmander.json — all cards parse", () => {
	it("is a non-empty array", () => {
		expect(Array.isArray(charmanderRaw)).toBe(true);
		expect((charmanderRaw as unknown[]).length).toBeGreaterThan(0);
	});

	it("each card passes Zod validation", () => {
		for (const raw of charmanderRaw as unknown[]) {
			expect(() => parseCardDefinition(raw)).not.toThrow();
		}
	});

	it("no duplicate ids within charmander pool", () => {
		const ids = (charmanderRaw as unknown[]).map((r) => parseCardDefinition(r).id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("all cards have at least one effect", () => {
		for (const raw of charmanderRaw as unknown[]) {
			const def = parseCardDefinition(raw);
			expect(def.effects.length).toBeGreaterThan(0);
		}
	});

	it("all cards have valid energyCost (≥ 0)", () => {
		for (const raw of charmanderRaw as unknown[]) {
			const def = parseCardDefinition(raw);
			expect(def.energyCost).toBeGreaterThanOrEqual(0);
		}
	});
});

describe("treecko.json — all cards parse", () => {
	it("is a non-empty array", () => {
		expect(Array.isArray(treeckoRaw)).toBe(true);
		expect((treeckoRaw as unknown[]).length).toBeGreaterThan(0);
	});

	it("each card passes Zod validation", () => {
		for (const raw of treeckoRaw as unknown[]) {
			expect(() => parseCardDefinition(raw)).not.toThrow();
		}
	});

	it("no duplicate ids within treecko pool", () => {
		const ids = (treeckoRaw as unknown[]).map((r) => parseCardDefinition(r).id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("all cards have at least one effect", () => {
		for (const raw of treeckoRaw as unknown[]) {
			const def = parseCardDefinition(raw);
			expect(def.effects.length).toBeGreaterThan(0);
		}
	});

	it("all cards have valid energyCost (≥ 0)", () => {
		for (const raw of treeckoRaw as unknown[]) {
			const def = parseCardDefinition(raw);
			expect(def.energyCost).toBeGreaterThanOrEqual(0);
		}
	});
});

// ---------------------------------------------------------------------------
// No cross-pool id collisions
// ---------------------------------------------------------------------------

describe("card pool — no cross-pool id collisions", () => {
	it("all card ids across both pools are unique", () => {
		const charIds = (charmanderRaw as unknown[]).map((r) => parseCardDefinition(r).id);
		const treeckoIds = (treeckoRaw as unknown[]).map((r) => parseCardDefinition(r).id);
		const all = [...charIds, ...treeckoIds];
		expect(new Set(all).size).toBe(all.length);
	});
});

// ---------------------------------------------------------------------------
// CARD_REGISTRY
// ---------------------------------------------------------------------------

describe("CARD_REGISTRY", () => {
	it("contains all charmander cards", () => {
		for (const raw of charmanderRaw as unknown[]) {
			const def = parseCardDefinition(raw);
			expect(CARD_REGISTRY.has(def.id)).toBe(true);
		}
	});

	it("contains all treecko cards", () => {
		for (const raw of treeckoRaw as unknown[]) {
			const def = parseCardDefinition(raw);
			expect(CARD_REGISTRY.has(def.id)).toBe(true);
		}
	});

	it("total size equals sum of both pools", () => {
		expect(CARD_REGISTRY.size).toBe(
			(charmanderRaw as unknown[]).length + (treeckoRaw as unknown[]).length,
		);
	});
});

// ---------------------------------------------------------------------------
// getCardDefinition
// ---------------------------------------------------------------------------

describe("getCardDefinition()", () => {
	it("returns Scratch by id", () => {
		const card = getCardDefinition("scratch");
		expect(card.name).toBe("Scratch");
	});

	it("returns Pound by id", () => {
		const card = getCardDefinition("pound");
		expect(card.name).toBe("Pound");
	});

	it("throws for unknown id", () => {
		expect(() => getCardDefinition("nonexistent-card")).toThrow();
	});

	it("returned definition has correct rarity", () => {
		expect(getCardDefinition("fire-blast").rarity).toBe("rare");
		expect(getCardDefinition("leaf-storm").rarity).toBe("rare");
	});

	it("returned definition has correct category", () => {
		expect(getCardDefinition("scratch").category).toBe("attack");
		expect(getCardDefinition("growl").category).toBe("skill");
		expect(getCardDefinition("swords-dance").category).toBe("power");
	});
});

// ---------------------------------------------------------------------------
// createStarterDeck — charmander
// ---------------------------------------------------------------------------

describe("createStarterDeck('charmander')", () => {
	const rng = new Rng(42);

	it("returns 10 card instances", () => {
		expect(createStarterDeck("charmander", rng)).toHaveLength(10);
	});

	it("contains 5 scratch instances", () => {
		const deck = createStarterDeck("charmander", new Rng(1));
		const scratchCount = deck.filter((c) => c.definitionId === "scratch").length;
		expect(scratchCount).toBe(5);
	});

	it("contains 4 growl instances", () => {
		const deck = createStarterDeck("charmander", new Rng(1));
		const growlCount = deck.filter((c) => c.definitionId === "growl").length;
		expect(growlCount).toBe(4);
	});

	it("contains 1 ember instance", () => {
		const deck = createStarterDeck("charmander", new Rng(1));
		const emberCount = deck.filter((c) => c.definitionId === "ember").length;
		expect(emberCount).toBe(1);
	});

	it("all instances start at upgradeLevel 0", () => {
		const deck = createStarterDeck("charmander", new Rng(1));
		expect(deck.every((c) => c.upgradeLevel === 0)).toBe(true);
	});

	it("all instanceIds are unique", () => {
		const deck = createStarterDeck("charmander", new Rng(1));
		const ids = deck.map((c) => c.instanceId);
		expect(new Set(ids).size).toBe(10);
	});

	it("all definitionIds exist in CARD_REGISTRY", () => {
		const deck = createStarterDeck("charmander", new Rng(1));
		for (const inst of deck) {
			expect(CARD_REGISTRY.has(inst.definitionId)).toBe(true);
		}
	});

	it("same seed produces identical deck order (deterministic)", () => {
		const a = createStarterDeck("charmander", new Rng(99));
		const b = createStarterDeck("charmander", new Rng(99));
		expect(a.map((c) => c.instanceId)).toEqual(b.map((c) => c.instanceId));
	});

	it("different seeds produce different deck orders", () => {
		const a = createStarterDeck("charmander", new Rng(1));
		const b = createStarterDeck("charmander", new Rng(2));
		expect(a.map((c) => c.instanceId)).not.toEqual(b.map((c) => c.instanceId));
	});
});

// ---------------------------------------------------------------------------
// createStarterDeck — treecko
// ---------------------------------------------------------------------------

describe("createStarterDeck('treecko')", () => {
	it("returns 10 card instances", () => {
		expect(createStarterDeck("treecko", new Rng(1))).toHaveLength(10);
	});

	it("contains 5 pound instances", () => {
		const deck = createStarterDeck("treecko", new Rng(1));
		expect(deck.filter((c) => c.definitionId === "pound")).toHaveLength(5);
	});

	it("contains 4 harden instances", () => {
		const deck = createStarterDeck("treecko", new Rng(1));
		expect(deck.filter((c) => c.definitionId === "harden")).toHaveLength(4);
	});

	it("contains 1 absorb instance", () => {
		const deck = createStarterDeck("treecko", new Rng(1));
		expect(deck.filter((c) => c.definitionId === "absorb")).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Card content spot-checks
// ---------------------------------------------------------------------------

describe("card content spot-checks", () => {
	it("ember has 2 effects (damage + applyStatus)", () => {
		const ember = getCardDefinition("ember");
		expect(ember.effects).toHaveLength(2);
		expect(ember.effects[0]?.kind).toBe("damage");
		expect(ember.effects[1]?.kind).toBe("applyStatus");
	});

	it("flare-blitz self-burn has toSelf true", () => {
		const fb = getCardDefinition("flare-blitz");
		const burnEffect = fb.effects.find((e) => e.kind === "applyStatus");
		expect(burnEffect?.kind).toBe("applyStatus");
		if (burnEffect?.kind === "applyStatus") expect(burnEffect.toSelf).toBe(true);
	});

	it("bullet-seed has exactly 3 damage effects", () => {
		const bs = getCardDefinition("bullet-seed");
		const dmgEffects = bs.effects.filter((e) => e.kind === "damage");
		expect(dmgEffects).toHaveLength(3);
	});

	it("leaf-blade has conditional second damage effect", () => {
		const lb = getCardDefinition("leaf-blade");
		expect(lb.effects).toHaveLength(2);
		const secondEffect = lb.effects[1];
		expect(secondEffect?.kind).toBe("damage");
		if (secondEffect?.kind === "damage") {
			expect(secondEffect.condition?.when).toBe("handSizeAtLeast");
		}
	});

	it("absorb heals after dealing damage", () => {
		const absorb = getCardDefinition("absorb");
		expect(absorb.effects[0]?.kind).toBe("damage");
		expect(absorb.effects[1]?.kind).toBe("heal");
	});

	it("leaf-storm draws cards after dealing damage", () => {
		const ls = getCardDefinition("leaf-storm");
		expect(ls.effects[0]?.kind).toBe("damage");
		expect(ls.effects[1]?.kind).toBe("drawCards");
	});

	it("fire-blast has exhaust effect", () => {
		const fb = getCardDefinition("fire-blast");
		expect(fb.effects.some((e) => e.kind === "exhaust")).toBe(true);
	});

	it("swords-dance is a power card", () => {
		expect(getCardDefinition("swords-dance").category).toBe("power");
	});

	it("fire-spin targets allEnemies", () => {
		expect(getCardDefinition("fire-spin").target).toBe("allEnemies");
	});
});

// ---------------------------------------------------------------------------
// Upgrade correctness via resolveCard
// ---------------------------------------------------------------------------

describe("upgrade via resolveCard()", () => {
	it("scratch+ deals 9 damage (up from 6)", () => {
		const def = getCardDefinition("scratch");
		const resolved = resolveCard(def, 1);
		const effect = resolved.effects[0];
		expect(effect?.kind).toBe("damage");
		if (effect?.kind === "damage") expect(effect.amount).toBe(9);
	});

	it("growl+ gives 8 block (up from 5)", () => {
		const def = getCardDefinition("growl");
		const resolved = resolveCard(def, 1);
		const effect = resolved.effects[0];
		expect(effect?.kind).toBe("block");
		if (effect?.kind === "block") expect(effect.amount).toBe(8);
	});

	it("agility+ draws 4 cards (up from 3)", () => {
		const def = getCardDefinition("agility");
		const resolved = resolveCard(def, 1);
		const effect = resolved.effects[0];
		expect(effect?.kind).toBe("drawCards");
		if (effect?.kind === "drawCards") expect(effect.count).toBe(4);
	});

	it("fire-blast+ adds burn application on upgrade", () => {
		const def = getCardDefinition("fire-blast");
		const resolved = resolveCard(def, 1);
		expect(resolved.effects.some((e) => e.kind === "applyStatus")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getStarterPool
// ---------------------------------------------------------------------------

describe("getStarterPool()", () => {
	it("charmander pool contains 15 cards", () => {
		expect(getStarterPool("charmander")).toHaveLength(15);
	});

	it("treecko pool contains 15 cards", () => {
		expect(getStarterPool("treecko")).toHaveLength(15);
	});

	it("charmander pool contains ember", () => {
		const pool = getStarterPool("charmander");
		expect(pool.some((c) => c.id === "ember")).toBe(true);
	});

	it("treecko pool contains absorb", () => {
		const pool = getStarterPool("treecko");
		expect(pool.some((c) => c.id === "absorb")).toBe(true);
	});

	it("charmander pool does not contain treecko cards", () => {
		const pool = getStarterPool("charmander");
		const treeckoOnlyIds = ["pound", "harden", "absorb", "leaf-blade", "giga-drain"];
		for (const id of treeckoOnlyIds) {
			expect(pool.some((c) => c.id === id)).toBe(false);
		}
	});

	it("charmander pool has at least 1 attack, 1 skill, 1 power card", () => {
		const pool = getStarterPool("charmander");
		expect(pool.some((c) => c.category === "attack")).toBe(true);
		expect(pool.some((c) => c.category === "skill")).toBe(true);
		expect(pool.some((c) => c.category === "power")).toBe(true);
	});

	it("treecko pool has at least 1 attack and 1 skill card", () => {
		const pool = getStarterPool("treecko");
		expect(pool.some((c) => c.category === "attack")).toBe(true);
		expect(pool.some((c) => c.category === "skill")).toBe(true);
	});

	it("charmander pool has at least 1 rare card", () => {
		const pool = getStarterPool("charmander");
		expect(pool.some((c) => c.rarity === "rare")).toBe(true);
	});
});
