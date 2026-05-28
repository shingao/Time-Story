import type { PlayerSnapshot } from "@core/run/types.ts";
import { describe, expect, it } from "vitest";
import type { RunContext } from "./campfire-options.ts";
import { getCampfireOptions } from "./campfire-options.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_SNAPSHOT: PlayerSnapshot = {
	currentHp: 30,
	maxHp: 44,
	gold: 5,
	deckCardIds: [
		"scratch",
		"scratch",
		"scratch",
		"scratch",
		"scratch",
		"growl",
		"growl",
		"growl",
		"growl",
		"ember",
	],
	relicIds: [],
	partnerState: null,
	timeGearCount: 0,
	cardUpgrades: {},
};

function makeCtx(snapshot: PlayerSnapshot): RunContext {
	return { playerSnapshot: snapshot };
}

// ---------------------------------------------------------------------------
// Pray
// ---------------------------------------------------------------------------

describe("Pray", () => {
	it("is always available", () => {
		const opts = getCampfireOptions();
		const pray = opts.find((o) => o.id === "pray");
		if (!pray) return;
		expect(pray.isAvailable(makeCtx(BASE_SNAPSHOT))).toBe(true);
	});

	it("heals floor(maxHp * 0.3) HP", () => {
		const opts = getCampfireOptions();
		const pray = opts.find((o) => o.id === "pray");
		if (!pray) return;
		// heal = floor(44 * 0.3) = 13; currentHp 30 + 13 = 43
		const result = pray.execute(makeCtx(BASE_SNAPSHOT));
		expect(result.kind).toBe("instant");
		if (result.kind !== "instant") return;
		expect(result.updatedPlayer.currentHp).toBe(43);
	});

	it("caps heal at maxHp", () => {
		const opts = getCampfireOptions();
		const pray = opts.find((o) => o.id === "pray");
		if (!pray) return;
		const nearFull = { ...BASE_SNAPSHOT, currentHp: 40 };
		// heal = 13; 40 + 13 = 53 → capped at 44
		const result = pray.execute(makeCtx(nearFull));
		if (result.kind !== "instant") return;
		expect(result.updatedPlayer.currentHp).toBe(44);
	});

	it("does not mutate other snapshot fields", () => {
		const opts = getCampfireOptions();
		const pray = opts.find((o) => o.id === "pray");
		if (!pray) return;
		const result = pray.execute(makeCtx(BASE_SNAPSHOT));
		if (result.kind !== "instant") return;
		expect(result.updatedPlayer.gold).toBe(BASE_SNAPSHOT.gold);
		expect(result.updatedPlayer.deckCardIds).toBe(BASE_SNAPSHOT.deckCardIds);
		expect(result.updatedPlayer.cardUpgrades).toBe(BASE_SNAPSHOT.cardUpgrades);
	});
});

// ---------------------------------------------------------------------------
// Train
// ---------------------------------------------------------------------------

describe("Train", () => {
	it("is available when deck has upgradable cards", () => {
		const opts = getCampfireOptions();
		const train = opts.find((o) => o.id === "train");
		if (!train) return;
		expect(train.isAvailable(makeCtx(BASE_SNAPSHOT))).toBe(true);
	});

	it("is not available when all cards are at level 2", () => {
		const opts = getCampfireOptions();
		const train = opts.find((o) => o.id === "train");
		if (!train) return;
		const allMaxed: PlayerSnapshot = {
			...BASE_SNAPSHOT,
			cardUpgrades: {
				"scratch-0": 2,
				"scratch-1": 2,
				"scratch-2": 2,
				"scratch-3": 2,
				"scratch-4": 2,
				"growl-5": 2,
				"growl-6": 2,
				"growl-7": 2,
				"growl-8": 2,
				"ember-9": 2,
			},
		};
		expect(train.isAvailable(makeCtx(allMaxed))).toBe(false);
	});

	it("is still available when only some cards are maxed", () => {
		const opts = getCampfireOptions();
		const train = opts.find((o) => o.id === "train");
		if (!train) return;
		const partial: PlayerSnapshot = {
			...BASE_SNAPSHOT,
			cardUpgrades: { "scratch-0": 2, "scratch-1": 2 },
		};
		// growl/ember cards still upgradable
		expect(train.isAvailable(makeCtx(partial))).toBe(true);
	});

	it("returns requires-card-selection", () => {
		const opts = getCampfireOptions();
		const train = opts.find((o) => o.id === "train");
		if (!train) return;
		const result = train.execute(makeCtx(BASE_SNAPSHOT));
		expect(result.kind).toBe("requires-card-selection");
	});

	it("onCardSelected upgrades the instance from level 0 to 1", () => {
		const opts = getCampfireOptions();
		const train = opts.find((o) => o.id === "train");
		if (!train) return;
		const result = train.execute(makeCtx(BASE_SNAPSHOT));
		if (result.kind !== "requires-card-selection") return;
		const updated = result.onCardSelected("scratch-0");
		expect(updated.cardUpgrades["scratch-0"]).toBe(1);
	});

	it("onCardSelected does not affect other card instances", () => {
		const opts = getCampfireOptions();
		const train = opts.find((o) => o.id === "train");
		if (!train) return;
		const result = train.execute(makeCtx(BASE_SNAPSHOT));
		if (result.kind !== "requires-card-selection") return;
		const updated = result.onCardSelected("scratch-0");
		expect(updated.cardUpgrades["scratch-1"] ?? 0).toBe(0);
		expect(updated.cardUpgrades["growl-5"] ?? 0).toBe(0);
		expect(updated.cardUpgrades["ember-9"] ?? 0).toBe(0);
	});

	it("onCardSelected upgrades from level 1 to 2 (second campfire)", () => {
		const opts = getCampfireOptions();
		const train = opts.find((o) => o.id === "train");
		if (!train) return;
		const oneUpgraded: PlayerSnapshot = { ...BASE_SNAPSHOT, cardUpgrades: { "scratch-0": 1 } };
		const result = train.execute(makeCtx(oneUpgraded));
		if (result.kind !== "requires-card-selection") return;
		const updated = result.onCardSelected("scratch-0");
		expect(updated.cardUpgrades["scratch-0"]).toBe(2);
	});

	it("onCardSelected caps at level 2 if somehow called on a maxed card", () => {
		const opts = getCampfireOptions();
		const train = opts.find((o) => o.id === "train");
		if (!train) return;
		const oneMaxed: PlayerSnapshot = { ...BASE_SNAPSHOT, cardUpgrades: { "scratch-0": 2 } };
		const result = train.execute(makeCtx(oneMaxed));
		if (result.kind !== "requires-card-selection") return;
		const updated = result.onCardSelected("scratch-0");
		expect(updated.cardUpgrades["scratch-0"]).toBe(2); // capped, not 3
	});
});

// ---------------------------------------------------------------------------
// Reflect
// ---------------------------------------------------------------------------

describe("Reflect", () => {
	it("is never available", () => {
		const opts = getCampfireOptions();
		const reflect = opts.find((o) => o.id === "reflect");
		if (!reflect) return;
		expect(reflect.isAvailable(makeCtx(BASE_SNAPSHOT))).toBe(false);
	});

	it("appears in the registry (UI slot reservation)", () => {
		const ids = getCampfireOptions().map((o) => o.id);
		expect(ids).toContain("reflect");
	});
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe("getCampfireOptions", () => {
	it("returns all three options in order: pray, train, reflect", () => {
		const opts = getCampfireOptions();
		expect(opts).toHaveLength(3);
		expect(opts.map((o) => o.id)).toEqual(["pray", "train", "reflect"]);
	});

	it("filters to pray + train when all cards are upgradable", () => {
		const ctx = makeCtx(BASE_SNAPSHOT);
		const available = getCampfireOptions().filter((o) => o.isAvailable(ctx));
		expect(available.map((o) => o.id)).toEqual(["pray", "train"]);
	});

	it("filters to only pray when all cards are maxed", () => {
		const allMaxed: PlayerSnapshot = {
			...BASE_SNAPSHOT,
			cardUpgrades: {
				"scratch-0": 2,
				"scratch-1": 2,
				"scratch-2": 2,
				"scratch-3": 2,
				"scratch-4": 2,
				"growl-5": 2,
				"growl-6": 2,
				"growl-7": 2,
				"growl-8": 2,
				"ember-9": 2,
			},
		};
		const ctx = makeCtx(allMaxed);
		const available = getCampfireOptions().filter((o) => o.isAvailable(ctx));
		expect(available.map((o) => o.id)).toEqual(["pray"]);
	});
});
