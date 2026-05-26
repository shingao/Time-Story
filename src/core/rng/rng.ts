/**
 * Deterministic seeded PRNG using mulberry32.
 * ALL randomness in core/ must flow through an Rng instance.
 * Never use Math.random() in core/.
 *
 * Same seed → identical sequence. Serialise state with getSeedState()
 * and restore with new Rng(savedState).
 */
export class Rng {
	private seed: number;

	constructor(seed: number) {
		this.seed = seed >>> 0; // coerce to uint32
	}

	// -------------------------------------------------------------------------
	// Core — mulberry32
	// -------------------------------------------------------------------------

	/** Returns the next float in [0, 1). */
	next(): number {
		this.seed = (this.seed + 0x6d2b79f5) >>> 0;
		let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	// -------------------------------------------------------------------------
	// Derived helpers
	// -------------------------------------------------------------------------

	/** Returns an integer in [min, max] inclusive. */
	nextInt(min: number, max: number): number {
		if (min > max) throw new Error(`nextInt: min (${min}) must be ≤ max (${max})`);
		if (min === max) return min;
		return min + Math.floor(this.next() * (max - min + 1));
	}

	/** Returns a random element. Throws on empty array. */
	pick<T>(arr: readonly T[]): T {
		if (arr.length === 0) throw new Error("pick: cannot pick from empty array");
		const idx = this.nextInt(0, arr.length - 1);
		const item = arr[idx];
		if (item === undefined) throw new Error("pick: index out of bounds (should never happen)");
		return item;
	}

	/**
	 * Returns a new array with elements in uniformly random order.
	 * Uses Fisher-Yates — O(n), unbiased.
	 */
	shuffle<T>(arr: readonly T[]): T[] {
		const out = arr.slice();
		for (let i = out.length - 1; i > 0; i--) {
			const j = this.nextInt(0, i);
			const a = out[i];
			const b = out[j];
			// Both indices are valid; noUncheckedIndexedAccess requires explicit check
			if (a !== undefined && b !== undefined) {
				out[i] = b;
				out[j] = a;
			}
		}
		return out;
	}

	/**
	 * Returns an item selected proportionally to its weight.
	 * Throws if items is empty, any weight is negative, or total weight is 0.
	 */
	weighted<T>(items: ReadonlyArray<{ readonly item: T; readonly weight: number }>): T {
		if (items.length === 0) throw new Error("weighted: items must not be empty");

		let total = 0;
		for (const { weight } of items) {
			if (weight < 0) throw new Error(`weighted: weight must be ≥ 0, got ${weight}`);
			total += weight;
		}
		if (total <= 0) throw new Error("weighted: total weight must be > 0");

		let roll = this.next() * total;
		for (const { item, weight } of items) {
			roll -= weight;
			if (roll < 0) return item;
		}

		// Floating-point edge: roll landed exactly on 0 after the last subtraction.
		// Return the last item with non-zero weight.
		for (let i = items.length - 1; i >= 0; i--) {
			const entry = items[i];
			if (entry !== undefined && entry.weight > 0) return entry.item;
		}
		throw new Error("weighted: no valid item found (unreachable)");
	}

	// -------------------------------------------------------------------------
	// Serialisation
	// -------------------------------------------------------------------------

	/**
	 * Returns the current internal seed state.
	 * Restore with: new Rng(savedState)
	 */
	getSeedState(): number {
		return this.seed;
	}
}
