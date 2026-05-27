import type { ActMapConfig, DungeonMap, MapNode, NodeId } from "./types.ts";
import { makeNodeId } from "./types.ts";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ValidationResult {
	readonly valid: boolean;
	readonly errors: readonly string[];
}

// ---------------------------------------------------------------------------
// Internal checks
// ---------------------------------------------------------------------------

function checkStructure(map: DungeonMap, errors: string[]): void {
	// Boss node must exist
	if (!map.nodes.has(map.bossNodeId)) {
		errors.push(`Boss node ${map.bossNodeId} not found in nodes map`);
	}

	// Start nodes must exist and be on floor 0
	for (const id of map.startNodeIds) {
		const node = map.nodes.get(id);
		if (!node) {
			errors.push(`Start node ${id} not found in nodes map`);
		} else if (node.floor !== 0) {
			errors.push(`Start node ${id} is on floor ${node.floor}, expected floor 0`);
		}
	}

	// Every node's ID must match its (floor, column) coordinates
	for (const [id, node] of map.nodes) {
		const expectedId = makeNodeId(node.floor, node.column);
		if (id !== expectedId || node.id !== expectedId) {
			errors.push(`Node ID mismatch: stored as ${id}, coordinates imply ${expectedId}`);
		}

		// Edges must point to valid nodes on the next floor
		for (const edgeId of node.edges) {
			const target = map.nodes.get(edgeId);
			if (!target) {
				errors.push(`Node ${id} has edge to non-existent node ${edgeId}`);
			} else if (target.floor !== node.floor + 1) {
				errors.push(
					`Node ${id} (floor ${node.floor}) has edge to ${edgeId} on floor ${target.floor} — must be floor ${node.floor + 1}`,
				);
			}
		}

		// Non-boss nodes must have at least one edge
		if (node.floor < map.numFloors - 1 && node.edges.length === 0) {
			errors.push(`Non-boss node ${id} (floor ${node.floor}) has no outgoing edges`);
		}

		// Boss node must have no edges
		if (node.floor === map.numFloors - 1 && node.edges.length > 0) {
			errors.push(`Boss node ${id} has outgoing edges (should have none)`);
		}
	}
}

function checkNoEdgeCrossings(map: DungeonMap, errors: string[]): void {
	// For each floor, collect edges as (fromCol, toCol) pairs and verify none cross.
	// Two edges (a→b) and (c→d) cross iff (a-c)*(b-d) < 0.
	const floorEdges = new Map<number, Array<[number, number]>>();

	for (const node of map.nodes.values()) {
		for (const edgeId of node.edges) {
			const target = map.nodes.get(edgeId);
			if (!target) continue;
			const bucket = floorEdges.get(node.floor) ?? [];
			bucket.push([node.column, target.column]);
			floorEdges.set(node.floor, bucket);
		}
	}

	for (const [floor, edges] of floorEdges) {
		for (let i = 0; i < edges.length; i++) {
			for (let j = i + 1; j < edges.length; j++) {
				const [a, b] = edges[i]!;
				const [c, d] = edges[j]!;
				if ((a - c) * (b - d) < 0) {
					errors.push(`Edge crossing at floor ${floor}: (col ${a}→${b}) crosses (col ${c}→${d})`);
				}
			}
		}
	}
}

function checkRoomTypeConstraints(map: DungeonMap, config: ActMapConfig, errors: string[]): void {
	for (const node of map.nodes.values()) {
		const { floor, type, id } = node;

		// Fixed floor check
		const expectedFixed = config.fixedFloorTypes[floor];
		if (expectedFixed !== undefined && type !== expectedFixed) {
			errors.push(`Node ${id} on fixed floor ${floor}: expected ${expectedFixed}, got ${type}`);
		}

		// noTypeBeforeFloor
		const minFloor = config.noTypeBeforeFloor[type] ?? -1;
		if (floor <= minFloor) {
			errors.push(
				`Node ${id}: type "${type}" is forbidden before floor ${minFloor + 1}, but floor is ${floor}`,
			);
		}
	}

	// Check consecutive and adjacent constraints by walking edges
	for (const node of map.nodes.values()) {
		const predecessors = getPredecessors(node.id, map);
		for (const pred of predecessors) {
			const predType = pred.type;
			const curType = node.type;

			// No consecutive same type
			if (config.noConsecutiveTypes.includes(curType) && predType === curType) {
				errors.push(`Consecutive "${curType}": node ${pred.id} → node ${node.id}`);
			}

			// No forbidden adjacent pairs [current, predecessor]
			for (const [current, predecessor] of config.noAdjacentPairs) {
				if (current === curType && predecessor === predType) {
					errors.push(`Forbidden adjacency "${predType}" → "${curType}": ${pred.id} → ${node.id}`);
				}
			}
		}
	}
}

function checkConnectivity(map: DungeonMap, errors: string[]): void {
	// Verify boss is reachable from every start node via BFS
	for (const startId of map.startNodeIds) {
		if (!canReach(startId, map.bossNodeId, map)) {
			errors.push(`Boss node ${map.bossNodeId} is not reachable from start node ${startId}`);
		}
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPredecessors(nodeId: NodeId, map: DungeonMap): MapNode[] {
	const node = map.nodes.get(nodeId);
	if (!node || node.floor === 0) return [];
	const result: MapNode[] = [];
	for (const candidate of map.nodes.values()) {
		if (candidate.floor === node.floor - 1 && candidate.edges.includes(nodeId)) {
			result.push(candidate);
		}
	}
	return result;
}

function canReach(from: NodeId, to: NodeId, map: DungeonMap): boolean {
	const visited = new Set<NodeId>();
	const queue: NodeId[] = [from];
	while (queue.length > 0) {
		const current = queue.shift()!;
		if (current === to) return true;
		if (visited.has(current)) continue;
		visited.add(current);
		const node = map.nodes.get(current);
		if (node) {
			for (const edgeId of node.edges) {
				if (!visited.has(edgeId)) queue.push(edgeId);
			}
		}
	}
	return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function validateDungeonMap(map: DungeonMap, config: ActMapConfig): ValidationResult {
	const errors: string[] = [];

	checkStructure(map, errors);
	if (errors.length === 0) {
		// Skip remaining checks if structure is broken — they'd produce noise
		checkNoEdgeCrossings(map, errors);
		checkRoomTypeConstraints(map, config, errors);
		checkConnectivity(map, errors);
	}

	return { valid: errors.length === 0, errors };
}
