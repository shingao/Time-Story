import type { MapNode, NodeId } from "@core/dungeon/types.ts";
import type { LineState } from "./ConnectionLine.tsx";
import { ConnectionLine } from "./ConnectionLine.tsx";
import { NODE_SIZE, nodeX, nodeY, totalMapHeight } from "./mapLayout.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MapSvgProps {
	readonly nodes: ReadonlyMap<NodeId, MapNode>;
	readonly numColumns: number;
	readonly viewportWidth: number;
	readonly availableNodeIds: ReadonlySet<NodeId>;
	readonly visitedNodeIds: ReadonlySet<NodeId>;
	readonly currentNodeId: NodeId | null;
}

// ---------------------------------------------------------------------------
// Helper: determine line state based on endpoint states
// ---------------------------------------------------------------------------

function getLineState(
	fromId: NodeId,
	toId: NodeId,
	visitedNodeIds: ReadonlySet<NodeId>,
	availableNodeIds: ReadonlySet<NodeId>,
	currentNodeId: NodeId | null,
): LineState {
	// Both visited: fully completed path
	if (visitedNodeIds.has(fromId) && visitedNodeIds.has(toId)) return "visited";
	// "from" is visited or current, "to" is available: highlight path forward
	if ((visitedNodeIds.has(fromId) || fromId === currentNodeId) && availableNodeIds.has(toId))
		return "available";
	// Current node pointing to available targets
	if (fromId === currentNodeId && availableNodeIds.has(toId)) return "available";
	return "locked";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MapSvg({
	nodes,
	numColumns,
	viewportWidth,
	availableNodeIds,
	visitedNodeIds,
	currentNodeId,
}: MapSvgProps) {
	const mapH = totalMapHeight();

	return (
		<svg
			role="presentation"
			aria-hidden
			width={viewportWidth}
			height={mapH}
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				pointerEvents: "none",
				zIndex: 1,
				overflow: "visible",
			}}
		>
			{Array.from(nodes.values()).map((node) =>
				node.edges.map((edgeId) => {
					const target = nodes.get(edgeId);
					if (!target) return null;

					const x1 = nodeX(node.column, numColumns, viewportWidth);
					const y1 = nodeY(node.floor) + NODE_SIZE / 2;
					const x2 = nodeX(target.column, numColumns, viewportWidth);
					const y2 = nodeY(target.floor) + NODE_SIZE / 2;

					const lineState = getLineState(
						node.id,
						edgeId,
						visitedNodeIds,
						availableNodeIds,
						currentNodeId,
					);

					return (
						<ConnectionLine
							key={`${String(node.id)}-${String(edgeId)}`}
							x1={x1}
							y1={y1}
							x2={x2}
							y2={y2}
							lineState={lineState}
						/>
					);
				}),
			)}
		</svg>
	);
}
