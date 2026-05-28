import { Rng } from "@core/rng/rng.ts";
import { describe, expect, it } from "vitest";
import { generateCardReward, generateRewardGold } from "./reward-generator.ts";

// ---------------------------------------------------------------------------
// Gold generation
// ---------------------------------------------------------------------------

describe("generateRewardGold", () => {
	it("produces gold in the normal tier range [10, 20]", () => {
		for (let seed = 0; seed < 200; seed++) {
			const gold = generateRewardGold("normal", new Rng(seed));
			expect(gold).toBeGreaterThanOrEqual(10);
			expect(gold).toBeLessThanOrEqual(20);
		}
	});

	it("produces gold in the elite tier range [25, 40]", () => {
		for (let seed = 0; seed < 200; seed++) {
			const gold = generateRewardGold("elite", new Rng(seed));
			expect(gold).toBeGreaterThanOrEqual(25);
			expect(gold).toBeLessThanOrEqual(40);
		}
	});

	it("produces gold in the boss tier range [50, 80]", () => {
		for (let seed = 0; seed < 200; seed++) {
			const gold = generateRewardGold("boss", new Rng(seed));
			expect(gold).toBeGreaterThanOrEqual(50);
			expect(gold).toBeLessThanOrEqual(80);
		}
	});

	it("is deterministic — same seed gives same gold", () => {
		const a = generateRewardGold("elite", new Rng(42));
		const b = generateRewardGold("elite", new Rng(42));
		expect(a).toBe(b);
	});
});

// ---------------------------------------------------------------------------
// Card reward generation
// ---------------------------------------------------------------------------

describe("generateCardReward", () => {
	it("returns up to 3 cards", () => {
		const cards = generateCardReward("charmander", "normal", new Rng(1));
		expect(cards.length).toBeGreaterThanOrEqual(1);
		expect(cards.length).toBeLessThanOrEqual(3);
	});

	it("returns distinct cards (no duplicates)", () => {
		for (let seed = 0; seed < 100; seed++) {
			const cards = generateCardReward("charmander", "normal", new Rng(seed));
			const unique = new Set(cards);
			expect(unique.size).toBe(cards.length);
		}
	});

	it("never includes starter-rarity cards", () => {
		// scratch, growl, ember are starter rarity for charmander
		for (let seed = 0; seed < 100; seed++) {
			const cards = generateCardReward("charmander", "normal", new Rng(seed));
			expect(cards).not.toContain("scratch");
			expect(cards).not.toContain("growl");
			expect(cards).not.toContain("ember");
		}
	});

	it("is deterministic — same seed gives same choices", () => {
		const a = generateCardReward("charmander", "elite", new Rng(99));
		const b = generateCardReward("charmander", "elite", new Rng(99));
		expect(a).toEqual(b);
	});

	it("works for treecko pool", () => {
		const cards = generateCardReward("treecko", "normal", new Rng(7));
		expect(cards.length).toBeGreaterThanOrEqual(1);
		expect(cards).not.toContain("pound");
		expect(cards).not.toContain("harden");
		expect(cards).not.toContain("absorb");
	});

	it("boss tier skews toward rarer cards over 1000 samples", () => {
		// Boss weights: common=20, uncommon=50, rare=30 → rare should appear frequently.
		// fire-blast (only rare) has weight 30 out of ~370 total, spread over 3 picks.
		// Expected presence in ~24% of samples → >150 is a stable lower bound.
		const rareCounts: Record<string, number> = {};
		for (let seed = 0; seed < 1000; seed++) {
			const cards = generateCardReward("charmander", "boss", new Rng(seed));
			for (const c of cards) {
				rareCounts[c] = (rareCounts[c] ?? 0) + 1;
			}
		}
		const fireBlastCount = rareCounts["fire-blast"] ?? 0;
		expect(fireBlastCount).toBeGreaterThan(150);
	});

	it("normal tier has rare cards appear less often than boss tier", () => {
		let normalRare = 0;
		let bossRare = 0;
		for (let seed = 0; seed < 500; seed++) {
			if (generateCardReward("charmander", "normal", new Rng(seed)).includes("fire-blast"))
				normalRare++;
			if (generateCardReward("charmander", "boss", new Rng(seed)).includes("fire-blast"))
				bossRare++;
		}
		expect(bossRare).toBeGreaterThan(normalRare);
	});

	it("does not crash when pool is small (returns fewer than 3)", () => {
		// treecko pool — just run without throwing
		const cards = generateCardReward("treecko", "boss", new Rng(0));
		expect(cards).toBeDefined();
		expect(Array.isArray(cards)).toBe(true);
	});
});
