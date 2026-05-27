import { z } from "zod";
import type { DungeonMap, MapNode, NodeId, RoomType } from "./types.ts";
import { asNodeId } from "./types.ts";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const roomTypeSchema = z.enum([
	"combat",
	"event",
	"elite",
	"campfire",
	"shop",
	"treasure",
	"boss",
] as const) satisfies z.ZodType<RoomType>;

const nodeIdSchema = z.string().min(1).transform(asNodeId);

const serializedNodeSchema = z.object({
	id: nodeIdSchema,
	floor: z.number().int().nonnegative(),
	column: z.number().int().nonnegative(),
	type: roomTypeSchema,
	edges: z.array(nodeIdSchema),
});

const serializedMapSchema = z.object({
	numFloors: z.number().int().positive(),
	numColumns: z.number().int().positive(),
	startNodeIds: z.array(nodeIdSchema),
	bossNodeId: nodeIdSchema,
	nodes: z.array(serializedNodeSchema),
});

// ---------------------------------------------------------------------------
// Serialized form — plain objects suitable for JSON.stringify
// ---------------------------------------------------------------------------

export interface SerializedMapNode {
	readonly id: string;
	readonly floor: number;
	readonly column: number;
	readonly type: RoomType;
	readonly edges: readonly string[];
}

export interface SerializedDungeonMap {
	readonly numFloors: number;
	readonly numColumns: number;
	readonly startNodeIds: readonly string[];
	readonly bossNodeId: string;
	readonly nodes: readonly SerializedMapNode[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function serializeDungeonMap(map: DungeonMap): SerializedDungeonMap {
	const nodes: SerializedMapNode[] = [];
	for (const node of map.nodes.values()) {
		nodes.push({
			id: String(node.id),
			floor: node.floor,
			column: node.column,
			type: node.type,
			edges: node.edges.map(String),
		});
	}
	// Stable order: sort by floor then column
	nodes.sort((a, b) => a.floor - b.floor || a.column - b.column);

	return {
		numFloors: map.numFloors,
		numColumns: map.numColumns,
		startNodeIds: map.startNodeIds.map(String),
		bossNodeId: String(map.bossNodeId),
		nodes,
	};
}

export function deserializeDungeonMap(data: unknown): DungeonMap {
	const parsed = serializedMapSchema.parse(data);

	const nodeMap = new Map<NodeId, MapNode>();
	for (const n of parsed.nodes) {
		nodeMap.set(n.id, {
			id: n.id,
			floor: n.floor,
			column: n.column,
			type: n.type,
			edges: n.edges,
		});
	}

	return {
		nodes: nodeMap,
		numFloors: parsed.numFloors,
		numColumns: parsed.numColumns,
		startNodeIds: parsed.startNodeIds,
		bossNodeId: parsed.bossNodeId,
	};
}
