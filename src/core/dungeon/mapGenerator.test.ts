import { describe, expect, it } from "vitest";
import { ACT1_CONFIG, generateDungeonMap, getActConfig } from "./mapGenerator.ts";
import { validateDungeonMap } from "./mapValidator.ts";
import { serializeDungeonMap } from "./schema.ts";
import { makeNodeId } from "./types.ts";

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe("generateDungeonMap — smoke tests", () => {
	it("returns a DungeonMap with the expected floor and column counts", () => {
		const map = generateDungeonMap(42, 1);
		expect(map.numFloors).toBe(16);
		expect(map.numColumns).toBe(7);
	});

	it("boss node is at the last floor", () => {
		const map = generateDungeonMap(42, 1);
		const boss = map.nodes.get(map.bossNodeId);
		expect(boss).toBeDefined();
		expect(boss!.floor).toBe(15);
		expect(boss!.type).toBe("boss");
	});

	it("start nodes are all on floor 0", () => {
		const map = generateDungeonMap(42, 1);
		expect(map.startNodeIds.length).toBeGreaterThan(0);
		for (const id of map.startNodeIds) {
			expect(map.nodes.get(id)?.floor).toBe(0);
		}
	});

	it("all floor-0 nodes have type 'combat'", () => {
		const map = generateDungeonMap(42, 1);
		for (const id of map.startNodeIds) {
			expect(map.nodes.get(id)?.type).toBe("combat");
		}
	});

	it("floor 8 nodes have type 'treasure'", () => {
		const map = generateDungeonMap(42, 1);
		for (const node of map.nodes.values()) {
			if (node.floor === 8) expect(node.type).toBe("treasure");
		}
	});

	it("floor 14 nodes have type 'campfire'", () => {
		const map = generateDungeonMap(42, 1);
		for (const node of map.nodes.values()) {
			if (node.floor === 14) expect(node.type).toBe("campfire");
		}
	});

	it("floor 15 node has type 'boss'", () => {
		const map = generateDungeonMap(42, 1);
		const bossId = makeNodeId(15, 3);
		expect(map.nodes.get(bossId)?.type).toBe("boss");
	});

	it("validates clean with the default Act 1 config", () => {
		const map = generateDungeonMap(42, 1);
		const result = validateDungeonMap(map, ACT1_CONFIG);
		expect(result.valid, result.errors.join("\n")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("generateDungeonMap — determinism", () => {
	it("same seed + actNumber produces identical serialised maps", () => {
		for (const seed of [0, 1, 42, 999, 12345]) {
			const map1 = serializeDungeonMap(generateDungeonMap(seed, 1));
			const map2 = serializeDungeonMap(generateDungeonMap(seed, 1));
			expect(map1).toEqual(map2);
		}
	});

	it("different seeds produce different maps (probabilistic)", () => {
		const maps = [0, 1, 2, 3, 4].map((seed) =>
			JSON.stringify(serializeDungeonMap(generateDungeonMap(seed, 1))),
		);
		const unique = new Set(maps);
		// It's astronomically unlikely all 5 seeds produce identical maps
		expect(unique.size).toBeGreaterThan(1);
	});
});

// ---------------------------------------------------------------------------
// getActConfig
// ---------------------------------------------------------------------------

describe("getActConfig", () => {
	it("returns ACT1_CONFIG for actNumber=1", () => {
		expect(getActConfig(1)).toBe(ACT1_CONFIG);
	});

	it("falls back to ACT1_CONFIG for unknown act numbers", () => {
		expect(getActConfig(99)).toBe(ACT1_CONFIG);
	});
});

// ---------------------------------------------------------------------------
// Property-based tests — 1000 seeds
// ---------------------------------------------------------------------------

describe("generateDungeonMap — property tests (1000 seeds)", () => {
	it("every map is valid according to the validator", () => {
		for (let seed = 0; seed < 1000; seed++) {
			const map = generateDungeonMap(seed, 1);
			const result = validateDungeonMap(map, ACT1_CONFIG);
			expect(result.valid, `seed ${seed} produced errors:\n${result.errors.join("\n")}`).toBe(true);
		}
	});

	it("every map has 1-6 start nodes on floor 0", () => {
		for (let seed = 0; seed < 1000; seed++) {
			const map = generateDungeonMap(seed, 1);
			expect(map.startNodeIds.length).toBeGreaterThanOrEqual(1);
			expect(map.startNodeIds.length).toBeLessThanOrEqual(6);
		}
	});

	it("every map has exactly one boss node", () => {
		for (let seed = 0; seed < 1000; seed++) {
			const map = generateDungeonMap(seed, 1);
			const bossNodes = Array.from(map.nodes.values()).filter((n) => n.type === "boss");
			expect(bossNodes.length).toBe(1);
		}
	});

	it("no campfire or elite appears on floors 1-4 (any seed)", () => {
		for (let seed = 0; seed < 1000; seed++) {
			const map = generateDungeonMap(seed, 1);
			for (const node of map.nodes.values()) {
				if (node.floor >= 1 && node.floor <= 4) {
					expect(node.type, `seed ${seed}, node ${node.id} has forbidden type`).not.toMatch(
						/campfire|elite/,
					);
				}
			}
		}
	});

	it("no edges cross (sorted-walk invariant)", () => {
		for (let seed = 0; seed < 1000; seed++) {
			const map = generateDungeonMap(seed, 1);
			const result = validateDungeonMap(map, ACT1_CONFIG);
			const crossErrors = result.errors.filter((e) => e.includes("crossing"));
			expect(crossErrors.length, `seed ${seed}: ${crossErrors.join("; ")}`).toBe(0);
		}
	});
});
