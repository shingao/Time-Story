import { describe, expect, it } from "vitest";
import { createRunCombat } from "./runCombatFactory.ts";
import type { PlayerSnapshot } from "./types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHARMANDER_SNAPSHOT: PlayerSnapshot = {
	currentHp: 20,
	maxHp: 44,
	gold: 10,
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
};

const TREECKO_SNAPSHOT: PlayerSnapshot = {
	currentHp: 40,
	maxHp: 40,
	gold: 0,
	deckCardIds: [
		"pound",
		"pound",
		"pound",
		"pound",
		"pound",
		"harden",
		"harden",
		"harden",
		"harden",
		"absorb",
	],
	relicIds: [],
	partnerState: null,
	timeGearCount: 0,
};

const SEED = 12345;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createRunCombat", () => {
	it("preserves currentHp from the snapshot (not maxHp)", () => {
		const state = createRunCombat(CHARMANDER_SNAPSHOT, "charmander", "pidgey", SEED);
		expect(state.player.hp).toBe(20);
		expect(state.player.maxHp).toBe(44);
	});

	it("creates the correct deck size matching deckCardIds length", () => {
		const state = createRunCombat(CHARMANDER_SNAPSHOT, "charmander", "pidgey", SEED);
		const totalCards =
			state.drawPile.length +
			state.hand.length +
			state.discardPile.length +
			state.exhaustPile.length;
		expect(totalCards).toBe(CHARMANDER_SNAPSHOT.deckCardIds.length);
	});

	it("shuffles cards into drawPile (not in original order)", () => {
		// Run 20 times with different seeds and check at least one differs from original order
		let atLeastOneDiffers = false;
		for (let s = 0; s < 20; s++) {
			const state = createRunCombat(CHARMANDER_SNAPSHOT, "charmander", "pidgey", s * 17 + 1);
			if (state.drawPile.some((c, i) => c.definitionId !== CHARMANDER_SNAPSHOT.deckCardIds[i])) {
				atLeastOneDiffers = true;
				break;
			}
		}
		expect(atLeastOneDiffers).toBe(true);
	});

	it("creates a pidgey enemy", () => {
		const state = createRunCombat(CHARMANDER_SNAPSHOT, "charmander", "pidgey", SEED);
		expect(state.enemies).toHaveLength(1);
		expect(String(state.enemies[0]?.definitionId)).toBe("pidgey");
	});

	it("works with treecko starter", () => {
		const state = createRunCombat(TREECKO_SNAPSHOT, "treecko", "caterpie", SEED);
		expect(state.player.name).toBe("Treecko");
		expect(state.player.hp).toBe(40);
		expect(String(state.enemies[0]?.definitionId)).toBe("caterpie");
	});

	it("starts with empty hand, discard, and exhaust piles", () => {
		const state = createRunCombat(CHARMANDER_SNAPSHOT, "charmander", "pidgey", SEED);
		expect(state.hand).toHaveLength(0);
		expect(state.discardPile).toHaveLength(0);
		expect(state.exhaustPile).toHaveLength(0);
	});

	it("player has correct type for charmander", () => {
		const state = createRunCombat(CHARMANDER_SNAPSHOT, "charmander", "pidgey", SEED);
		expect(state.player.types).toContain("fire");
	});

	it("player has correct type for treecko", () => {
		const state = createRunCombat(TREECKO_SNAPSHOT, "treecko", "zubat", SEED);
		expect(state.player.types).toContain("grass");
	});

	it("uses seed deterministically (same seed = same enemy HP)", () => {
		const state1 = createRunCombat(CHARMANDER_SNAPSHOT, "charmander", "pidgey", SEED);
		const state2 = createRunCombat(CHARMANDER_SNAPSHOT, "charmander", "pidgey", SEED);
		expect(state1.enemies[0]?.maxHp).toBe(state2.enemies[0]?.maxHp);
	});
});
