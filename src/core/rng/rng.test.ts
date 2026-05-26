import { describe, expect, it } from "vitest";
import { Rng } from "./rng.ts";

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("determinism", () => {
	it("same seed produces identical sequence", () => {
		const a = new Rng(42);
		const b = new Rng(42);
		for (let i = 0; i < 100; i++) {
			expect(a.next()).toBe(b.next());
		}
	});

	it("different seeds produce different sequences", () => {
		const a = new Rng(1);
		const b = new Rng(2);
		const seqA = Array.from({ length: 20 }, () => a.next());
		const seqB = Array.from({ length: 20 }, () => b.next());
		expect(seqA).not.toEqual(seqB);
	});

	it("seed 0 is valid and deterministic", () => {
		const r1 = new Rng(0);
		const r2 = new Rng(0);
		expect(r1.next()).toBe(r2.next());
	});

	it("non-integer seeds are coerced to uint32 (deterministic behaviour)", () => {
		// 42.9 >>> 0 === 42, so same as seed 42
		const a = new Rng(42);
		const b = new Rng(42.9);
		expect(a.next()).toBe(b.next());
	});
});

// ---------------------------------------------------------------------------
// next() — range invariant
// ---------------------------------------------------------------------------

describe("next()", () => {
	it("returns values in [0, 1)", () => {
		const rng = new Rng(99);
		for (let i = 0; i < 1000; i++) {
			const v = rng.next();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it("produces floats (not always 0)", () => {
		const rng = new Rng(1);
		const nonZero = Array.from({ length: 100 }, () => rng.next()).some((v) => v > 0);
		expect(nonZero).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// nextInt()
// ---------------------------------------------------------------------------

describe("nextInt()", () => {
	it("returns values within [min, max] inclusive", () => {
		const rng = new Rng(7);
		for (let i = 0; i < 1000; i++) {
			const v = rng.nextInt(3, 8);
			expect(v).toBeGreaterThanOrEqual(3);
			expect(v).toBeLessThanOrEqual(8);
		}
	});

	it("returns integer values", () => {
		const rng = new Rng(12);
		for (let i = 0; i < 100; i++) {
			expect(Number.isInteger(rng.nextInt(0, 100))).toBe(true);
		}
	});

	it("returns min when min === max", () => {
		const rng = new Rng(5);
		for (let i = 0; i < 10; i++) {
			expect(rng.nextInt(7, 7)).toBe(7);
		}
	});

	it("throws when min > max", () => {
		const rng = new Rng(1);
		expect(() => rng.nextInt(5, 3)).toThrow();
	});

	it("covers both endpoints over many calls", () => {
		const rng = new Rng(99);
		const hits = new Set<number>();
		for (let i = 0; i < 10000; i++) hits.add(rng.nextInt(0, 4));
		expect(hits.has(0)).toBe(true);
		expect(hits.has(4)).toBe(true);
	});

	it("nextInt(0, 0) always returns 0", () => {
		const rng = new Rng(123);
		for (let i = 0; i < 10; i++) expect(rng.nextInt(0, 0)).toBe(0);
	});

	it("works with negative ranges", () => {
		const rng = new Rng(42);
		for (let i = 0; i < 200; i++) {
			const v = rng.nextInt(-5, 5);
			expect(v).toBeGreaterThanOrEqual(-5);
			expect(v).toBeLessThanOrEqual(5);
		}
	});
});

// ---------------------------------------------------------------------------
// pick()
// ---------------------------------------------------------------------------

describe("pick()", () => {
	it("throws on empty array", () => {
		const rng = new Rng(1);
		expect(() => rng.pick([])).toThrow();
	});

	it("always returns the only element of a 1-element array", () => {
		const rng = new Rng(1);
		for (let i = 0; i < 20; i++) {
			expect(rng.pick(["only"])).toBe("only");
		}
	});

	it("returns elements that exist in the source array", () => {
		const rng = new Rng(7);
		const arr = ["a", "b", "c", "d", "e"] as const;
		for (let i = 0; i < 100; i++) {
			expect(arr).toContain(rng.pick(arr));
		}
	});

	it("can pick every element from the array over many tries", () => {
		const rng = new Rng(42);
		const arr = [1, 2, 3, 4, 5];
		const seen = new Set<number>();
		for (let i = 0; i < 10000; i++) seen.add(rng.pick(arr));
		expect(seen.size).toBe(5);
	});

	it("works with typed arrays", () => {
		const rng = new Rng(1);
		const arr: readonly number[] = [10, 20, 30];
		const v = rng.pick(arr);
		expect([10, 20, 30]).toContain(v);
	});
});

// ---------------------------------------------------------------------------
// shuffle() — correctness
// ---------------------------------------------------------------------------

describe("shuffle() — correctness", () => {
	it("returns empty array unchanged", () => {
		const rng = new Rng(1);
		expect(rng.shuffle([])).toEqual([]);
	});

	it("returns a 1-element array unchanged", () => {
		const rng = new Rng(1);
		expect(rng.shuffle([42])).toEqual([42]);
	});

	it("returns a new array (does not mutate input)", () => {
		const rng = new Rng(5);
		const original = [1, 2, 3, 4, 5];
		const result = rng.shuffle(original);
		expect(result).not.toBe(original);
		expect(original).toEqual([1, 2, 3, 4, 5]);
	});

	it("output has same elements as input", () => {
		const rng = new Rng(3);
		const input = [1, 2, 3, 4, 5, 6, 7, 8];
		const output = rng.shuffle(input);
		expect(output).toHaveLength(input.length);
		expect([...output].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
	});

	it("different seeds produce different shuffles", () => {
		const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const a = new Rng(1).shuffle(input);
		const b = new Rng(2).shuffle(input);
		expect(a).not.toEqual(b);
	});

	it("same seed produces same shuffle", () => {
		const input = [1, 2, 3, 4, 5];
		expect(new Rng(17).shuffle(input)).toEqual(new Rng(17).shuffle(input));
	});
});

// ---------------------------------------------------------------------------
// shuffle() — statistical unbiasedness (property-based, 30 000 samples)
// ---------------------------------------------------------------------------

describe("shuffle() — unbiasedness", () => {
	it("each element appears at each position with roughly equal frequency", () => {
		const N = 30_000;
		const arr = [0, 1, 2]; // 3 elements → 3×3 position matrix
		const SIZE = arr.length;
		// counts[element][position] = frequency
		const counts: number[][] = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
		const rng = new Rng(0xdeadbeef);

		for (let trial = 0; trial < N; trial++) {
			const shuffled = rng.shuffle(arr);
			for (let pos = 0; pos < SIZE; pos++) {
				const elem = shuffled[pos];
				if (elem !== undefined) {
					const row = counts[elem];
					if (row !== undefined) row[pos] = (row[pos] ?? 0) + 1;
				}
			}
		}

		// Expected frequency per cell: N / SIZE
		const expected = N / SIZE;
		const tolerance = 0.06; // ±6% — 5σ for N=30k is ~±2.8%

		for (let elem = 0; elem < SIZE; elem++) {
			for (let pos = 0; pos < SIZE; pos++) {
				const actual = counts[elem]?.[pos] ?? 0;
				expect(actual).toBeGreaterThan(expected * (1 - tolerance));
				expect(actual).toBeLessThan(expected * (1 + tolerance));
			}
		}
	});
});

// ---------------------------------------------------------------------------
// weighted()
// ---------------------------------------------------------------------------

describe("weighted()", () => {
	it("throws on empty items", () => {
		const rng = new Rng(1);
		expect(() => rng.weighted([])).toThrow();
	});

	it("throws on negative weight", () => {
		const rng = new Rng(1);
		expect(() => rng.weighted([{ item: "a", weight: -1 }])).toThrow();
	});

	it("throws when total weight is 0", () => {
		const rng = new Rng(1);
		expect(() =>
			rng.weighted([
				{ item: "a", weight: 0 },
				{ item: "b", weight: 0 },
			]),
		).toThrow();
	});

	it("always returns the only item with weight > 0", () => {
		const rng = new Rng(1);
		for (let i = 0; i < 20; i++) {
			expect(rng.weighted([{ item: "only", weight: 5 }])).toBe("only");
		}
	});

	it("returns an item that exists in the input", () => {
		const rng = new Rng(7);
		const items = [
			{ item: "a", weight: 1 },
			{ item: "b", weight: 2 },
			{ item: "c", weight: 3 },
		];
		for (let i = 0; i < 100; i++) {
			expect(["a", "b", "c"]).toContain(rng.weighted(items));
		}
	});

	it("item with weight 0 is never selected", () => {
		const rng = new Rng(99);
		const items = [
			{ item: "never", weight: 0 },
			{ item: "always", weight: 1 },
		];
		for (let i = 0; i < 200; i++) {
			expect(rng.weighted(items)).toBe("always");
		}
	});
});

// ---------------------------------------------------------------------------
// weighted() — statistical distribution (property-based, 30 000 samples)
// ---------------------------------------------------------------------------

describe("weighted() — distribution", () => {
	it("respects relative weights over many samples", () => {
		const N = 30_000;
		const items = [
			{ item: "rare", weight: 1 },
			{ item: "common", weight: 2 },
			{ item: "veryCommon", weight: 3 },
		];
		const total = 6;
		const counts: Record<string, number> = { rare: 0, common: 0, veryCommon: 0 };
		const rng = new Rng(0xbeefdead);

		for (let i = 0; i < N; i++) {
			const result = rng.weighted(items);
			counts[result] = (counts[result] ?? 0) + 1;
		}

		const tolerance = 0.07; // ±7%

		for (const { item, weight } of items) {
			const expectedFraction = weight / total;
			const actualFraction = (counts[item] ?? 0) / N;
			expect(actualFraction).toBeGreaterThan(expectedFraction - tolerance);
			expect(actualFraction).toBeLessThan(expectedFraction + tolerance);
		}
	});

	it("extreme weights are still respected (1:99 ratio)", () => {
		const N = 30_000;
		const items = [
			{ item: "tiny", weight: 1 },
			{ item: "huge", weight: 99 },
		];
		const counts = { tiny: 0, huge: 0 };
		const rng = new Rng(0xcafebabe);

		for (let i = 0; i < N; i++) {
			const r = rng.weighted(items);
			if (r === "tiny") counts.tiny++;
			else counts.huge++;
		}

		// tiny should be ~1%, huge ~99%
		expect(counts.tiny / N).toBeGreaterThan(0.005);
		expect(counts.tiny / N).toBeLessThan(0.02);
		expect(counts.huge / N).toBeGreaterThan(0.98);
	});
});

// ---------------------------------------------------------------------------
// getSeedState() — serialisation round-trip
// ---------------------------------------------------------------------------

describe("getSeedState()", () => {
	it("restoring state produces identical subsequent sequence", () => {
		const rng = new Rng(12345);
		// Advance N steps
		for (let i = 0; i < 50; i++) rng.next();

		const savedState = rng.getSeedState();

		// Capture next 20 values from original
		const fromOriginal = Array.from({ length: 20 }, () => rng.next());

		// Restore and capture same 20
		const restored = new Rng(savedState);
		const fromRestored = Array.from({ length: 20 }, () => restored.next());

		expect(fromOriginal).toEqual(fromRestored);
	});

	it("saved state is a number", () => {
		const rng = new Rng(1);
		expect(typeof rng.getSeedState()).toBe("number");
	});

	it("state changes after each next() call", () => {
		const rng = new Rng(1);
		const s0 = rng.getSeedState();
		rng.next();
		const s1 = rng.getSeedState();
		expect(s0).not.toBe(s1);
	});
});
