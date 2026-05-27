import type { MapNode, NodeId } from "@core/dungeon/types.ts";
import type { NodeState } from "./MapNodeIcon.tsx";
import { MapNodeIcon } from "./MapNodeIcon.tsx";
import { NODE_SIZE, nodeX, nodeY, totalMapHeight } from "./mapLayout.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MapNodesLayerProps {
	readonly nodes: ReadonlyMap<NodeId, MapNode>;
	readonly numColumns: number;
	readonly viewportWidth: number;
	readonly availableNodeIds: ReadonlySet<NodeId>;
	readonly visitedNodeIds: ReadonlySet<NodeId>;
	readonly currentNodeId: NodeId | null;
	readonly onNodeClick: (nodeId: NodeId) => void;
}

// ---------------------------------------------------------------------------
// Helper: compute state for a single node
// ---------------------------------------------------------------------------

function getNodeState(
	nodeId: NodeId,
	currentNodeId: NodeId | null,
	availableNodeIds: ReadonlySet<NodeId>,
	visitedNodeIds: ReadonlySet<NodeId>,
): NodeState {
	// Current = player is here and has NOT yet completed the node
	if (nodeId === currentNodeId && !visitedNodeIds.has(nodeId)) return "current";
	if (visitedNodeIds.has(nodeId)) return "visited";
	if (availableNodeIds.has(nodeId)) return "available";
	return "locked";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MapNodesLayer({
	nodes,
	numColumns,
	viewportWidth,
	availableNodeIds,
	visitedNodeIds,
	currentNodeId,
	onNodeClick,
}: MapNodesLayerProps) {
	const mapH = totalMapHeight();

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: viewportWidth,
				height: mapH,
				zIndex: 2,
				pointerEvents: "none",
			}}
		>
			{Array.from(nodes.values()).map((node) => {
				const cx = nodeX(node.column, numColumns, viewportWidth);
				const cy = nodeY(node.floor);
				const nodeState = getNodeState(node.id, currentNodeId, availableNodeIds, visitedNodeIds);

				return (
					<div
						key={String(node.id)}
						style={{
							position: "absolute",
							left: cx - NODE_SIZE / 2,
							top: cy,
							width: NODE_SIZE,
							height: NODE_SIZE,
							pointerEvents: "auto",
						}}
					>
						<MapNodeIcon node={node} nodeState={nodeState} onClick={() => onNodeClick(node.id)} />
					</div>
				);
			})}
		</div>
	);
}
