import { describe, expect, it } from "vitest";
import type { PlayerSnapshot, RunStatus, StarterName } from "./types.ts";

// ---------------------------------------------------------------------------
// Compile-time shape tests (structural / type-level)
// ---------------------------------------------------------------------------

describe("PlayerSnapshot", () => {
	it("accepts a valid snapshot object", () => {
		const snap: PlayerSnapshot = {
			currentHp: 30,
			maxHp: 44,
			gold: 5,
			deckCardIds: ["scratch", "scratch", "growl"],
			relicIds: [],
			partnerState: null,
			timeGearCount: 0,
			cardUpgrades: {},
		};
		expect(snap.currentHp).toBe(30);
		expect(snap.maxHp).toBe(44);
		expect(snap.gold).toBe(5);
		expect(snap.deckCardIds).toHaveLength(3);
		expect(snap.relicIds).toHaveLength(0);
		expect(snap.partnerState).toBeNull();
		expect(snap.timeGearCount).toBe(0);
	});

	it("allows deckCardIds with duplicates (multiples of the same card)", () => {
		const snap: PlayerSnapshot = {
			currentHp: 10,
			maxHp: 10,
			gold: 0,
			deckCardIds: ["scratch", "scratch", "scratch", "scratch", "scratch"],
			relicIds: [],
			partnerState: null,
			timeGearCount: 0,
			cardUpgrades: {},
		};
		expect(snap.deckCardIds).toHaveLength(5);
		expect(snap.deckCardIds.every((id) => id === "scratch")).toBe(true);
	});
});

describe("RunStatus", () => {
	it("covers all expected status strings", () => {
		const statuses: RunStatus[] = [
			"in_map",
			"in_combat",
			"in_event",
			"in_shop",
			"in_campfire",
			"in_treasure",
			"victory",
			"defeat",
		];
		expect(statuses).toHaveLength(8);
	});
});

describe("StarterName", () => {
	it("includes charmander and treecko", () => {
		const starters: StarterName[] = ["charmander", "treecko"];
		expect(starters).toHaveLength(2);
	});
});
