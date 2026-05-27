import type { MapNode, NodeId } from "@core/dungeon/types.ts";
import { animate, useMotionValue } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapBackground } from "./MapBackground.tsx";
import { MapNodesLayer } from "./MapNodesLayer.tsx";
import { MapSvg } from "./MapSvg.tsx";
import { computeScrollTarget, totalMapHeight } from "./mapLayout.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MapViewportProps {
	readonly nodes: ReadonlyMap<NodeId, MapNode>;
	readonly numColumns: number;
	readonly numFloors: number;
	readonly availableNodeIds: ReadonlySet<NodeId>;
	readonly visitedNodeIds: ReadonlySet<NodeId>;
	readonly currentNodeId: NodeId | null;
	readonly onNodeClick: (nodeId: NodeId) => void;
	readonly viewBossSignal: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MapViewport({
	nodes,
	numColumns,
	numFloors: _numFloors,
	availableNodeIds,
	visitedNodeIds,
	currentNodeId,
	onNodeClick,
	viewBossSignal,
}: MapViewportProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const heightRef = useRef(0);
	// Track width as state so re-renders pick up container width after mount
	const [viewportWidth, setViewportWidth] = useState(800);

	const scrollOffset = useMotionValue(0);
	const mapH = totalMapHeight();

	// Measure container, update width state on resize
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const ro = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (!rect) return;
			heightRef.current = rect.height;
			setViewportWidth(rect.width);
			// Keep inner width in sync for SVG/nodes absolute positioning
			if (innerRef.current) {
				innerRef.current.style.width = `${rect.width}px`;
			}
		});
		ro.observe(container);
		heightRef.current = container.clientHeight;
		setViewportWidth(container.clientWidth);
		return () => ro.disconnect();
	}, []);

	// Subscribe to scrollOffset changes and apply as CSS transform
	useEffect(() => {
		const inner = innerRef.current;
		if (!inner) return;
		return scrollOffset.on("change", (val) => {
			inner.style.transform = `translateY(${val}px)`;
		});
	}, [scrollOffset]);

	// Auto-scroll when currentNodeId changes — keep current floor at 70% from top
	useEffect(() => {
		const floor = currentNodeId ? (nodes.get(currentNodeId)?.floor ?? 0) : 0;
		const target = computeScrollTarget(floor, heightRef.current || 600);
		animate(scrollOffset, target, { duration: 0.6, ease: "easeOut" });
	}, [currentNodeId, nodes, scrollOffset]);

	// "View Boss" animation — scroll to boss, return after 2 s
	useEffect(() => {
		if (viewBossSignal === 0) return;
		const bossTarget = computeScrollTarget(15, heightRef.current || 600);
		animate(scrollOffset, bossTarget, { duration: 0.6, ease: "easeOut" });
		const t = setTimeout(() => {
			const floor = currentNodeId ? (nodes.get(currentNodeId)?.floor ?? 0) : 0;
			const homeTarget = computeScrollTarget(floor, heightRef.current || 600);
			animate(scrollOffset, homeTarget, { duration: 0.6, ease: "easeOut" });
		}, 2000);
		return () => clearTimeout(t);
	}, [viewBossSignal, currentNodeId, nodes, scrollOffset]);

	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			e.preventDefault();
			const viewH = heightRef.current || 600;
			const current = scrollOffset.get();
			const minScroll = -(mapH - viewH);
			const next = Math.max(minScroll, Math.min(0, current + -e.deltaY));
			scrollOffset.set(next);
		},
		[scrollOffset, mapH],
	);

	return (
		<div
			ref={containerRef}
			onWheel={handleWheel}
			style={{ position: "relative", overflow: "hidden", width: "100%", height: "100%" }}
		>
			<div
				ref={innerRef}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: viewportWidth,
					height: mapH,
					willChange: "transform",
				}}
			>
				<MapBackground />
				<MapSvg
					nodes={nodes}
					numColumns={numColumns}
					viewportWidth={viewportWidth}
					availableNodeIds={availableNodeIds}
					visitedNodeIds={visitedNodeIds}
					currentNodeId={currentNodeId}
				/>
				<MapNodesLayer
					nodes={nodes}
					numColumns={numColumns}
					viewportWidth={viewportWidth}
					availableNodeIds={availableNodeIds}
					visitedNodeIds={visitedNodeIds}
					currentNodeId={currentNodeId}
					onNodeClick={onNodeClick}
				/>
			</div>
		</div>
	);
}
