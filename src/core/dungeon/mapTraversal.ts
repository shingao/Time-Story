import type { DungeonMap, MapNode, NodeId } from "./types.ts";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns all nodes on the given floor, sorted by column. */
export function getNodesOnFloor(map: DungeonMap, floor: number): readonly MapNode[] {
	const result: MapNode[] = [];
	for (const node of map.nodes.values()) {
		if (node.floor === floor) result.push(node);
	}
	return result.sort((a, b) => a.column - b.column);
}

/**
 * Returns the nodes directly reachable from `currentNodeId` (i.e., nodes on
 * the next floor connected by an outgoing edge).
 */
export function getNextAvailableNodes(map: DungeonMap, currentNodeId: NodeId): readonly MapNode[] {
	const node = map.nodes.get(currentNodeId);
	if (!node) return [];
	const result: MapNode[] = [];
	for (const edgeId of node.edges) {
		const target = map.nodes.get(edgeId);
		if (target) result.push(target);
	}
	return result.sort((a, b) => a.column - b.column);
}

/**
 * Returns whether `targetNodeId` can be reached from any node in `fromNodeIds`
 * by following edges forward through the map.
 */
export function isNodeReachable(
	map: DungeonMap,
	targetNodeId: NodeId,
	fromNodeIds: readonly NodeId[],
): boolean {
	const visited = new Set<NodeId>();
	const queue: NodeId[] = [...fromNodeIds];

	while (queue.length > 0) {
		const current = queue.shift()!;
		if (current === targetNodeId) return true;
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

/**
 * Enumerates all root-to-boss paths as arrays of NodeIds. Uses DFS with an
 * iteration cap to prevent combinatorial explosion on pathological inputs.
 */
export function getAllPaths(map: DungeonMap, maxPaths = 5000): readonly (readonly NodeId[])[] {
	const results: NodeId[][] = [];
	const stack: { nodeId: NodeId; path: NodeId[] }[] = map.startNodeIds.map((id) => ({
		nodeId: id,
		path: [id],
	}));

	while (stack.length > 0 && results.length < maxPaths) {
		const { nodeId, path } = stack.pop()!;

		if (nodeId === map.bossNodeId) {
			results.push(path);
			continue;
		}

		const node = map.nodes.get(nodeId);
		if (!node) continue;

		for (const edgeId of node.edges) {
			stack.push({ nodeId: edgeId, path: [...path, edgeId] });
		}
	}

	return results;
}
