// ---------------------------------------------------------------------------
// Branded ID
// ---------------------------------------------------------------------------

export type NodeId = string & { readonly __brand: "NodeId" };

export function asNodeId(s: string): NodeId {
	return s as NodeId;
}

export function makeNodeId(floor: number, column: number): NodeId {
	return asNodeId(`n${floor}-${column}`);
}

// ---------------------------------------------------------------------------
// Room types
// ---------------------------------------------------------------------------

export type RoomType = "combat" | "event" | "elite" | "campfire" | "shop" | "treasure" | "boss";

// ---------------------------------------------------------------------------
// Map node
// ---------------------------------------------------------------------------

export interface MapNode {
	readonly id: NodeId;
	readonly floor: number;
	readonly column: number;
	readonly type: RoomType;
	/** Node IDs on the next floor reachable from here. Empty for boss floor. */
	readonly edges: readonly NodeId[];
}

// ---------------------------------------------------------------------------
// Dungeon map
// ---------------------------------------------------------------------------

export interface DungeonMap {
	readonly nodes: ReadonlyMap<NodeId, MapNode>;
	readonly numFloors: number;
	readonly numColumns: number;
	/** Node IDs on floor 0 — the valid starting positions. */
	readonly startNodeIds: readonly NodeId[];
	/** The single boss node ID (last floor). */
	readonly bossNodeId: NodeId;
}

// ---------------------------------------------------------------------------
// Act config — controls what the generator produces
// ---------------------------------------------------------------------------

export interface ActMapConfig {
	/** Total number of floors, including floor 0 (start) and the boss floor. */
	readonly numFloors: number;
	/** Number of columns (0-indexed). */
	readonly numColumns: number;
	/** Number of branching paths to weave through the map. */
	readonly numPaths: number;
	/** Column index where all paths converge on the boss floor. */
	readonly bossColumn: number;
	/**
	 * Weight table for random room assignment. Types with weight 0 are never
	 * randomly assigned (they may still appear via fixedFloorTypes).
	 */
	readonly roomWeights: Partial<Record<RoomType, number>>;
	/** Floor index → always assign this RoomType (overrides everything). */
	readonly fixedFloorTypes: Partial<Record<number, RoomType>>;
	/**
	 * `noTypeBeforeFloor[type] = F` means type is forbidden on floors 0..F
	 * (i.e., earliest allowed floor is F+1).
	 */
	readonly noTypeBeforeFloor: Partial<Record<RoomType, number>>;
	/** Types that may not appear in two consecutive floors along any path. */
	readonly noConsecutiveTypes: readonly RoomType[];
	/**
	 * Pairs [current, predecessor] that are forbidden: a node of type `current`
	 * may not immediately follow a node of type `predecessor`.
	 */
	readonly noAdjacentPairs: readonly (readonly [RoomType, RoomType])[];
}
