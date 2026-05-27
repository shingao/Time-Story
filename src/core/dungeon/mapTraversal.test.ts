import { describe, expect, it } from "vitest";
import { generateDungeonMap } from "./mapGenerator.ts";
import {
	getAllPaths,
	getNextAvailableNodes,
	getNodesOnFloor,
	isNodeReachable,
} from "./mapTraversal.ts";

const MAP = generateDungeonMap(42, 1);

describe("getNodesOnFloor", () => {
	it("returns nodes sorted by column", () => {
		const nodes = getNodesOnFloor(MAP, 0);
		expect(nodes.length).toBeGreaterThan(0);
		for (let i = 1; i < nodes.length; i++) {
			expect(nodes[i]!.column).toBeGreaterThanOrEqual(nodes[i - 1]!.column);
		}
	});

	it("returns empty array for out-of-range floor", () => {
		expect(getNodesOnFloor(MAP, 99)).toHaveLength(0);
	});

	it("floor 15 contains exactly one boss node", () => {
		const nodes = getNodesOnFloor(MAP, 15);
		expect(nodes).toHaveLength(1);
		expect(nodes[0]!.type).toBe("boss");
	});
});

describe("getNextAvailableNodes", () => {
	it("returns at least one next node from a floor-0 node", () => {
		const startId = MAP.startNodeIds[0];
		if (!startId) throw new Error("no start node");
		const next = getNextAvailableNodes(MAP, startId);
		expect(next.length).toBeGreaterThan(0);
	});

	it("returns empty array for boss node (no outgoing edges)", () => {
		const next = getNextAvailableNodes(MAP, MAP.bossNodeId);
		expect(next).toHaveLength(0);
	});

	it("returns empty array for unknown node ID", () => {
		// @ts-expect-error — intentionally passing invalid id
		const next = getNextAvailableNodes(MAP, "n99-99");
		expect(next).toHaveLength(0);
	});
});

describe("isNodeReachable", () => {
	it("boss is reachable from every start node", () => {
		for (const id of MAP.startNodeIds) {
			expect(isNodeReachable(MAP, MAP.bossNodeId, [id])).toBe(true);
		}
	});

	it("returns false for unreachable fake node", () => {
		// @ts-expect-error — intentionally invalid
		expect(isNodeReachable(MAP, "n99-99", MAP.startNodeIds)).toBe(false);
	});

	it("a start node is reachable from itself", () => {
		const id = MAP.startNodeIds[0]!;
		expect(isNodeReachable(MAP, id, [id])).toBe(true);
	});
});

describe("getAllPaths", () => {
	it("returns at least one path", () => {
		const paths = getAllPaths(MAP);
		expect(paths.length).toBeGreaterThan(0);
	});

	it("every path starts at a start node", () => {
		const startSet = new Set(MAP.startNodeIds);
		for (const path of getAllPaths(MAP)) {
			expect(startSet.has(path[0] as never)).toBe(true);
		}
	});

	it("every path ends at the boss node", () => {
		for (const path of getAllPaths(MAP)) {
			expect(path[path.length - 1]).toBe(MAP.bossNodeId);
		}
	});

	it("each path visits exactly numFloors nodes", () => {
		for (const path of getAllPaths(MAP)) {
			expect(path.length).toBe(MAP.numFloors);
		}
	});

	it("respects maxPaths cap", () => {
		const paths = getAllPaths(MAP, 3);
		expect(paths.length).toBeLessThanOrEqual(3);
	});
});
