import type { DungeonMap, RoomType } from "./types.ts";
import { makeNodeId } from "./types.ts";

// ---------------------------------------------------------------------------
// Room type glyphs for ASCII art
// ---------------------------------------------------------------------------

const TYPE_CHAR: Record<RoomType, string> = {
	combat: "M",
	event: "?",
	elite: "E",
	campfire: "R",
	shop: "$",
	treasure: "T",
	boss: "X",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a multi-line ASCII string visualising the dungeon map.
 * Floors are printed top-to-bottom (boss at top, start at bottom).
 * Columns are indexed left-to-right.
 *
 * Legend:
 *   M = combat, ? = event, E = elite, R = campfire,
 *   $ = shop, T = treasure, X = boss, . = empty cell
 */
export function printMapAscii(map: DungeonMap): string {
	const lines: string[] = [];

	// Print legend
	lines.push("╔═══ Dungeon Map ═══╗");
	lines.push("  M=combat ?=event E=elite");
	lines.push("  R=campfire $=shop T=treasure X=boss");
	lines.push("");

	// Print floors top-to-bottom (boss first)
	for (let f = map.numFloors - 1; f >= 0; f--) {
		const cells: string[] = [];
		for (let c = 0; c < map.numColumns; c++) {
			const nodeId = makeNodeId(f, c);
			const node = map.nodes.get(nodeId);
			cells.push(node ? TYPE_CHAR[node.type] : ".");
		}
		const floorLabel = String(f).padStart(2, "0");
		lines.push(`${floorLabel} | ${cells.join(" ")} |`);

		// Print edge connections to next floor (arrows between rows)
		if (f > 0) {
			const connectors: string[] = Array.from({ length: map.numColumns }, () => " ");
			for (let c = 0; c < map.numColumns; c++) {
				const nodeId = makeNodeId(f - 1, c);
				const node = map.nodes.get(nodeId);
				if (node) {
					for (const edgeId of node.edges) {
						const target = map.nodes.get(edgeId);
						if (target && target.floor === f) {
							const fromC = c;
							const toC = target.column;
							if (fromC === toC) {
								connectors[fromC] = "|";
							} else if (fromC < toC) {
								connectors[fromC] = "\\";
							} else {
								connectors[fromC] = "/";
							}
						}
					}
				}
			}
			lines.push(`   | ${connectors.join(" ")} |`);
		}
	}

	lines.push("╚══════════════════╝");
	return lines.join("\n");
}
