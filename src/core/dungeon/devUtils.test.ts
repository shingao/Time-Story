import { describe, expect, it } from "vitest";
import { printMapAscii } from "./devUtils.ts";
import { generateDungeonMap } from "./mapGenerator.ts";

describe("printMapAscii", () => {
	it("returns a non-empty string", () => {
		const map = generateDungeonMap(42, 1);
		const output = printMapAscii(map);
		expect(typeof output).toBe("string");
		expect(output.length).toBeGreaterThan(0);
	});

	it("contains a row for every floor", () => {
		const map = generateDungeonMap(42, 1);
		const output = printMapAscii(map);
		for (let f = 0; f < map.numFloors; f++) {
			const label = String(f).padStart(2, "0");
			expect(output).toContain(label);
		}
	});

	it("contains the boss marker 'X'", () => {
		const map = generateDungeonMap(42, 1);
		expect(printMapAscii(map)).toContain("X");
	});

	it("contains the combat marker 'M' (floor 0 is always combat)", () => {
		const map = generateDungeonMap(42, 1);
		expect(printMapAscii(map)).toContain("M");
	});

	it("produces consistent output for the same seed", () => {
		const map1 = generateDungeonMap(100, 1);
		const map2 = generateDungeonMap(100, 1);
		expect(printMapAscii(map1)).toBe(printMapAscii(map2));
	});
});
