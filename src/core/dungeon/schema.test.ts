import { describe, expect, it } from "vitest";
import { generateDungeonMap } from "./mapGenerator.ts";
import { deserializeDungeonMap, serializeDungeonMap } from "./schema.ts";

const MAP = generateDungeonMap(7, 1);

describe("serializeDungeonMap", () => {
	it("produces a plain object (JSON-safe)", () => {
		const serialized = serializeDungeonMap(MAP);
		expect(() => JSON.stringify(serialized)).not.toThrow();
	});

	it("nodes are sorted by floor then column", () => {
		const serialized = serializeDungeonMap(MAP);
		for (let i = 1; i < serialized.nodes.length; i++) {
			const prev = serialized.nodes[i - 1]!;
			const curr = serialized.nodes[i]!;
			const prevKey = prev.floor * 1000 + prev.column;
			const currKey = curr.floor * 1000 + curr.column;
			expect(currKey).toBeGreaterThanOrEqual(prevKey);
		}
	});

	it("preserves start node IDs and boss node ID", () => {
		const serialized = serializeDungeonMap(MAP);
		for (const id of MAP.startNodeIds) {
			expect(serialized.startNodeIds).toContain(String(id));
		}
		expect(serialized.bossNodeId).toBe(String(MAP.bossNodeId));
	});
});

describe("deserializeDungeonMap", () => {
	it("round-trips through serialize → deserialize", () => {
		const serialized = serializeDungeonMap(MAP);
		const restored = deserializeDungeonMap(serialized);

		expect(restored.numFloors).toBe(MAP.numFloors);
		expect(restored.numColumns).toBe(MAP.numColumns);
		expect(restored.nodes.size).toBe(MAP.nodes.size);
		expect(String(restored.bossNodeId)).toBe(String(MAP.bossNodeId));
	});

	it("re-serializing a deserialized map produces the same output", () => {
		const s1 = serializeDungeonMap(MAP);
		const s2 = serializeDungeonMap(deserializeDungeonMap(s1));
		expect(s1).toEqual(s2);
	});

	it("throws ZodError on invalid input", () => {
		expect(() => deserializeDungeonMap(null)).toThrow();
		expect(() => deserializeDungeonMap({ numFloors: "bad" })).toThrow();
	});
});
