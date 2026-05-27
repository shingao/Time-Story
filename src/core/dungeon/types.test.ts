import { describe, expect, it } from "vitest";
import { asNodeId, makeNodeId } from "./types.ts";

describe("makeNodeId", () => {
	it("encodes floor and column into a readable string", () => {
		expect(makeNodeId(0, 3)).toBe("n0-3");
		expect(makeNodeId(15, 6)).toBe("n15-6");
	});

	it("round-trips through asNodeId", () => {
		const id = makeNodeId(7, 2);
		expect(asNodeId(String(id))).toBe(id);
	});

	it("different coordinates produce different IDs", () => {
		const ids = new Set([makeNodeId(0, 0), makeNodeId(0, 1), makeNodeId(1, 0), makeNodeId(1, 1)]);
		expect(ids.size).toBe(4);
	});
});
