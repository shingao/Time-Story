import { describe, expect, it } from "vitest";
import { ACT1_CONFIG, generateDungeonMap } from "./mapGenerator.ts";
import { validateDungeonMap } from "./mapValidator.ts";
import type { DungeonMap, MapNode, NodeId } from "./types.ts";
import { makeNodeId } from "./types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneMap(map: DungeonMap): { nodes: Map<NodeId, MapNode> } & Omit<DungeonMap, "nodes"> {
	return {
		...map,
		nodes: new Map(
			Array.from(map.nodes.entries()).map(([id, n]) => [id, { ...n, edges: [...n.edges] }]),
		),
	};
}

// ---------------------------------------------------------------------------
// Valid map passes
// ---------------------------------------------------------------------------

describe("validateDungeonMap — valid maps", () => {
	it("passes for a generated map with seed 0", () => {
		const map = generateDungeonMap(0, 1);
		const result = validateDungeonMap(map, ACT1_CONFIG);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Boss node checks
// ---------------------------------------------------------------------------

describe("validateDungeonMap — boss node", () => {
	it("fails if boss node is missing from map", () => {
		const map = generateDungeonMap(1, 1);
		const mutMap = cloneMap(map);
		mutMap.nodes.delete(map.bossNodeId);
		const result = validateDungeonMap(mutMap as unknown as DungeonMap, ACT1_CONFIG);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("Boss node"))).toBe(true);
	});

	it("fails if boss node has outgoing edges", () => {
		const map = generateDungeonMap(2, 1);
		const mutMap = cloneMap(map);
		const bossNode = mutMap.nodes.get(map.bossNodeId);
		if (!bossNode) throw new Error("no boss node");
		// Artificially add a fake edge
		const fakeId = makeNodeId(99, 0);
		mutMap.nodes.set(map.bossNodeId, { ...bossNode, edges: [fakeId] });
		// Also add a stub node to avoid the "non-existent edge" error
		mutMap.nodes.set(fakeId, { id: fakeId, floor: 99, column: 0, type: "combat", edges: [] });
		const result = validateDungeonMap(mutMap as unknown as DungeonMap, ACT1_CONFIG);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("outgoing edges"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Edge checks
// ---------------------------------------------------------------------------

describe("validateDungeonMap — edge integrity", () => {
	it("fails if an edge points to a non-existent node", () => {
		const map = generateDungeonMap(3, 1);
		const mutMap = cloneMap(map);
		const firstNode = Array.from(mutMap.nodes.values()).find((n) => n.floor === 0);
		if (!firstNode) throw new Error("no floor-0 node");
		const ghostId = makeNodeId(1, 99);
		mutMap.nodes.set(firstNode.id, { ...firstNode, edges: [...firstNode.edges, ghostId] });
		const result = validateDungeonMap(mutMap as unknown as DungeonMap, ACT1_CONFIG);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("non-existent node"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Room type constraint checks
// ---------------------------------------------------------------------------

describe("validateDungeonMap — room type constraints", () => {
	it("fails if a fixed floor has wrong type", () => {
		const map = generateDungeonMap(4, 1);
		const mutMap = cloneMap(map);
		// Change a floor-8 node to 'combat'
		for (const [id, node] of mutMap.nodes) {
			if (node.floor === 8) {
				mutMap.nodes.set(id, { ...node, type: "combat" });
				break;
			}
		}
		const result = validateDungeonMap(mutMap as unknown as DungeonMap, ACT1_CONFIG);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("fixed floor"))).toBe(true);
	});

	it("fails if campfire appears on floor 3", () => {
		const map = generateDungeonMap(5, 1);
		const mutMap = cloneMap(map);
		for (const [id, node] of mutMap.nodes) {
			if (node.floor === 3) {
				mutMap.nodes.set(id, { ...node, type: "campfire" });
				break;
			}
		}
		const result = validateDungeonMap(mutMap as unknown as DungeonMap, ACT1_CONFIG);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("forbidden before"))).toBe(true);
	});
});
