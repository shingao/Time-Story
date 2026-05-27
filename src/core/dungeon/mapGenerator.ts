import { Rng } from "@core/rng/rng.ts";
import type { ActMapConfig, DungeonMap, MapNode, NodeId, RoomType } from "./types.ts";
import { makeNodeId } from "./types.ts";

// ---------------------------------------------------------------------------
// Default Act 1 config
// ---------------------------------------------------------------------------

export const ACT1_CONFIG: ActMapConfig = {
	numFloors: 16, // floors 0-15; boss is floor 15
	numColumns: 7, // columns 0-6; centre is 3
	numPaths: 6,
	bossColumn: 3,
	roomWeights: {
		combat: 45,
		event: 22,
		elite: 16,
		campfire: 12,
		shop: 5,
		treasure: 0, // only via fixedFloorTypes
		boss: 0, // only via fixedFloorTypes
	},
	fixedFloorTypes: {
		0: "combat",
		8: "treasure",
		14: "campfire",
		15: "boss",
	},
	// noTypeBeforeFloor: floor <= N means forbidden; earliest allowed = N+1
	noTypeBeforeFloor: {
		campfire: 4,
		elite: 4,
		shop: 4,
	},
	noConsecutiveTypes: ["campfire", "elite"],
	// [current, predecessor]: current cannot follow predecessor
	noAdjacentPairs: [
		["campfire", "shop"],
		["shop", "campfire"],
	],
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Generates `numPaths` column-position arrays, one per floor, using a sorted
 * random walk. Sorting candidate columns at every floor prevents edge crossings:
 * if paths[i].col[f] ≤ paths[j].col[f] for all f, then edges (col[f]→col[f+1])
 * for paths i and j never cross.
 */
function generateSortedPaths(
	rng: Rng,
	numPaths: number,
	numFloors: number,
	numColumns: number,
	bossColumn: number,
): number[][] {
	// paths[p][f] = column of path p at floor f
	const initCols: number[] = Array.from({ length: numPaths }, () => rng.nextInt(0, numColumns - 1));
	initCols.sort((a, b) => a - b);
	const paths: number[][] = initCols.map((c) => [c]);

	for (let f = 1; f < numFloors; f++) {
		if (f === numFloors - 1) {
			// Boss floor — all converge to bossColumn
			for (const path of paths) {
				path.push(bossColumn);
			}
		} else {
			const candidates: number[] = paths.map((p) => {
				const prev = p[p.length - 1] ?? 0;
				const delta = rng.nextInt(-1, 1);
				return Math.max(0, Math.min(numColumns - 1, prev + delta));
			});
			// Sort to maintain order → no crossings
			candidates.sort((a, b) => a - b);
			for (let p = 0; p < numPaths; p++) {
				paths[p]!.push(candidates[p]!);
			}
		}
	}
	return paths;
}

/**
 * Returns a room type for the given floor, respecting all config constraints.
 *
 * @param successorFixedTypes - fixed types of nodes on floor+1 that this node
 *   will have edges to. Used to prevent forbidden [successor, current] pairs
 *   even when the successor type is determined by `fixedFloorTypes`.
 */
function assignRoomType(
	floor: number,
	predecessorTypes: readonly RoomType[],
	successorFixedTypes: readonly RoomType[],
	config: ActMapConfig,
	rng: Rng,
): RoomType {
	const fixed = config.fixedFloorTypes[floor];
	if (fixed !== undefined) return fixed;

	const entries: { item: RoomType; weight: number }[] = [];

	for (const [rawType, weight] of Object.entries(config.roomWeights)) {
		const type = rawType as RoomType;
		if ((weight ?? 0) <= 0) continue;

		// Too early for this type
		const minFloor = config.noTypeBeforeFloor[type] ?? -1;
		if (floor <= minFloor) continue;

		// No consecutive same type along any predecessor OR fixed successor
		if (config.noConsecutiveTypes.includes(type) && predecessorTypes.includes(type)) continue;
		if (config.noConsecutiveTypes.includes(type) && successorFixedTypes.includes(type)) continue;

		// Forbidden adjacent pair — predecessor → current (e.g. campfire → shop)
		const blockedByPred = config.noAdjacentPairs.some(
			([current, predecessor]) => current === type && predecessorTypes.includes(predecessor),
		);
		if (blockedByPred) continue;

		// Forbidden adjacent pair — current → fixed successor (e.g. shop → campfire)
		// If assigning type T here would force a forbidden pair with a known fixed
		// successor type, reject T.
		const blockedBySucc = successorFixedTypes.some((succType) =>
			config.noAdjacentPairs.some(
				([current, predecessor]) => current === succType && predecessor === type,
			),
		);
		if (blockedBySucc) continue;

		entries.push({ item: type, weight: weight! });
	}

	// Fallback: if all types are blocked (rare edge case), use combat
	if (entries.length === 0) return "combat";

	return rng.weighted(entries);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns the canonical config for the given act number (1-indexed). */
export function getActConfig(actNumber: number): ActMapConfig {
	if (actNumber === 1) return ACT1_CONFIG;
	// Future acts can return different configs; fall back to Act 1 for now
	return ACT1_CONFIG;
}

/**
 * Generates a fully-connected, crossing-free dungeon map.
 *
 * @param seed     - uint32 seed for the RNG
 * @param actNumber - 1-indexed act number (determines default config)
 * @param config    - optional override; defaults to `getActConfig(actNumber)`
 */
export function generateDungeonMap(
	seed: number,
	actNumber: number,
	config?: ActMapConfig,
): DungeonMap {
	const cfg = config ?? getActConfig(actNumber);
	const rng = new Rng(seed >>> 0);

	// 1. Generate path column sequences
	const rawPaths = generateSortedPaths(
		rng,
		cfg.numPaths,
		cfg.numFloors,
		cfg.numColumns,
		cfg.bossColumn,
	);

	// 2. Build mutable node/edge structures
	type MutableNode = {
		id: NodeId;
		floor: number;
		column: number;
		edgeSet: Set<NodeId>;
		type: RoomType | null;
	};
	const nodeMap = new Map<NodeId, MutableNode>();

	function ensureNode(floor: number, col: number): MutableNode {
		const id = makeNodeId(floor, col);
		if (!nodeMap.has(id)) {
			nodeMap.set(id, { id, floor, column: col, edgeSet: new Set(), type: null });
		}
		return nodeMap.get(id)!;
	}

	for (const path of rawPaths) {
		for (let f = 0; f < cfg.numFloors; f++) {
			const col = path[f]!;
			ensureNode(f, col);
			if (f + 1 < cfg.numFloors) {
				const nextCol = path[f + 1]!;
				const node = ensureNode(f, col);
				const next = ensureNode(f + 1, nextCol);
				node.edgeSet.add(next.id);
			}
		}
	}

	// 3. Group nodes by floor (sorted by column) for type-assignment traversal
	const floorNodes = new Map<number, NodeId[]>();
	for (const [id, node] of nodeMap) {
		const bucket = floorNodes.get(node.floor) ?? [];
		bucket.push(id);
		floorNodes.set(node.floor, bucket);
	}
	for (const ids of floorNodes.values()) {
		ids.sort((a, b) => (nodeMap.get(a)?.column ?? 0) - (nodeMap.get(b)?.column ?? 0));
	}

	// 4. Assign room types floor by floor
	for (let f = 0; f < cfg.numFloors; f++) {
		const ids = floorNodes.get(f) ?? [];
		for (const id of ids) {
			const node = nodeMap.get(id)!;

			// Collect all predecessor types for this node
			const predecessorTypes: RoomType[] = [];
			if (f > 0) {
				for (const prevId of floorNodes.get(f - 1) ?? []) {
					const prev = nodeMap.get(prevId);
					if (prev?.edgeSet.has(id) && prev.type !== null) {
						predecessorTypes.push(prev.type);
					}
				}
			}

			// Collect fixed types of next-floor nodes this node connects to —
			// needed to prevent forbidden pairs when the successor is fixed.
			const successorFixedTypes: RoomType[] = [];
			const nextFixedType = cfg.fixedFloorTypes[f + 1];
			if (nextFixedType !== undefined && node.edgeSet.size > 0) {
				successorFixedTypes.push(nextFixedType);
			}

			node.type = assignRoomType(f, predecessorTypes, successorFixedTypes, cfg, rng);
		}
	}

	// 5. Build immutable result
	const finalNodes = new Map<NodeId, MapNode>();
	for (const [id, node] of nodeMap) {
		finalNodes.set(id, {
			id,
			floor: node.floor,
			column: node.column,
			type: node.type ?? "combat",
			edges: Array.from(node.edgeSet),
		});
	}

	const startNodeIds: NodeId[] = floorNodes.get(0) ?? [];
	const bossNodeId = makeNodeId(cfg.numFloors - 1, cfg.bossColumn);

	return {
		nodes: finalNodes,
		numFloors: cfg.numFloors,
		numColumns: cfg.numColumns,
		startNodeIds,
		bossNodeId,
	};
}
