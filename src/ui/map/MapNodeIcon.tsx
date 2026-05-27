import type { MapNode, RoomType } from "@core/dungeon/types.ts";
import { motion } from "framer-motion";
import { memo } from "react";
import { NODE_SIZE } from "./mapLayout.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NodeState = "locked" | "available" | "current" | "visited";

interface MapNodeIconProps {
	readonly node: MapNode;
	readonly nodeState: NodeState;
	readonly onClick?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_ICON: Record<RoomType, string> = {
	combat: "⚔",
	elite: "💀",
	event: "?",
	shop: "K",
	campfire: "🏛",
	treasure: "💎",
	boss: "☠",
};

const TYPE_COLOR: Record<RoomType, string> = {
	combat: "#f97316",
	elite: "#ef4444",
	event: "#06b6d4",
	shop: "#a855f7",
	campfire: "#eab308",
	treasure: "#f59e0b",
	boss: "#dc2626",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MapNodeIcon = memo(function MapNodeIcon({
	node,
	nodeState,
	onClick,
}: MapNodeIconProps) {
	const color = TYPE_COLOR[node.type];
	const icon = TYPE_ICON[node.type];
	const isInteractive = nodeState === "available" || nodeState === "current";

	const baseStyle: React.CSSProperties = {
		width: NODE_SIZE,
		height: NODE_SIZE,
		borderRadius: "50%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontSize: NODE_SIZE * 0.38,
		position: "relative",
		cursor: isInteractive ? "pointer" : "default",
		background: nodeState === "visited" ? "rgba(34,197,94,0.15)" : `${color}22`,
		border:
			nodeState === "current"
				? `2px solid ${color}`
				: nodeState === "visited"
					? "2px solid rgba(34,197,94,0.4)"
					: nodeState === "available"
						? `2px solid ${color}aa`
						: "2px solid rgba(255,255,255,0.1)",
		filter: nodeState === "locked" ? "grayscale(1)" : "none",
		opacity: nodeState === "locked" ? 0.3 : 1,
		userSelect: "none",
	};

	return (
		<motion.button
			type="button"
			aria-label={`${node.type} node (${nodeState})`}
			onClick={isInteractive ? onClick : undefined}
			style={baseStyle}
			animate={
				nodeState === "available"
					? {
							boxShadow: [
								`0 0 8px 2px ${color}60`,
								`0 0 16px 6px ${color}90`,
								`0 0 8px 2px ${color}60`,
							],
						}
					: {}
			}
			transition={
				nodeState === "available"
					? { duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
					: {}
			}
			whileHover={isInteractive ? { scale: 1.12 } : {}}
			whileTap={isInteractive ? { scale: 0.94 } : {}}
		>
			{/* Rotating ring for current node */}
			{nodeState === "current" && (
				<motion.div
					className="pointer-events-none absolute"
					style={{
						inset: -5,
						borderRadius: "50%",
						border: "2px solid rgba(255,255,255,0.9)",
					}}
					animate={{ rotate: 360 }}
					transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
				/>
			)}

			{/* Icon */}
			<span aria-hidden style={{ pointerEvents: "none" }}>
				{icon}
			</span>

			{/* Visited checkmark overlay */}
			{nodeState === "visited" && (
				<span
					aria-hidden
					style={{
						position: "absolute",
						bottom: -2,
						right: -2,
						fontSize: 12,
						background: "rgba(34,197,94,0.9)",
						borderRadius: "50%",
						width: 16,
						height: 16,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "white",
						fontWeight: "bold",
					}}
				>
					✓
				</span>
			)}
		</motion.button>
	);
});
