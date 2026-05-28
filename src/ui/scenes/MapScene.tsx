import { deserializeDungeonMap } from "@core/dungeon/schema.ts";
import type { NodeId } from "@core/dungeon/types.ts";
import { asNodeId } from "@core/dungeon/types.ts";
import { computeAvailableNodeIds, useRunStore } from "@state/useRunStore.ts";
import { useUIStore } from "@state/useUIStore.ts";
import { CombatBackground } from "@ui/combat/CombatBackground.tsx";
import { MapHeader } from "@ui/map/MapHeader.tsx";
import { MapViewport } from "@ui/map/MapViewport.tsx";
import { StubRoomModal } from "@ui/map/StubRoomModal.tsx";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

// ---------------------------------------------------------------------------
// VictoryScreen
// ---------------------------------------------------------------------------

function VictoryScreen({ onReturn }: { onReturn: () => void }) {
	return (
		<div
			className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6"
			style={{ background: "rgba(0,0,0,0.85)", fontFamily: "var(--font-pmd)" }}
		>
			<motion.div
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ duration: 0.4, ease: "easeOut" }}
				className="flex flex-col items-center gap-4 text-center"
			>
				<div style={{ fontSize: 72 }}>🏆</div>
				<h1 className="font-bold text-3xl" style={{ color: "#f59e0b" }}>
					Act 1 Complete!
				</h1>
				<p className="text-white/60 text-sm">The dungeon has been conquered.</p>
				<motion.button
					type="button"
					onClick={onReturn}
					className="mt-2 rounded-xl px-8 py-3 font-semibold text-white"
					style={{ background: "rgba(245,158,11,0.8)", border: "1px solid rgba(255,255,255,0.2)" }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
				>
					Return to Menu
				</motion.button>
			</motion.div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// DefeatScreen
// ---------------------------------------------------------------------------

function DefeatScreen({ onReturn }: { onReturn: () => void }) {
	return (
		<div
			className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6"
			style={{ background: "rgba(0,0,0,0.9)", fontFamily: "var(--font-pmd)" }}
		>
			<motion.div
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ duration: 0.4, ease: "easeOut" }}
				className="flex flex-col items-center gap-4 text-center"
			>
				<div style={{ fontSize: 72 }}>💀</div>
				<h1 className="font-bold text-3xl" style={{ color: "#ef4444" }}>
					You Fainted…
				</h1>
				<p className="text-white/60 text-sm">The dungeon defeated you this time.</p>
				<motion.button
					type="button"
					onClick={onReturn}
					className="mt-2 rounded-xl px-8 py-3 font-semibold text-white"
					style={{ background: "rgba(239,68,68,0.7)", border: "1px solid rgba(255,255,255,0.15)" }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
				>
					Return to Menu
				</motion.button>
			</motion.div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// MapScene
// ---------------------------------------------------------------------------

interface MapSceneProps {
	readonly onEndRun: () => void;
}

export function MapScene({ onEndRun }: MapSceneProps) {
	const {
		serializedMap,
		currentNodeId: currentNodeIdStr,
		visitedNodeIds: visitedNodeIdStrs,
		status,
		currentAct,
		playerSnapshot,
	} = useRunStore(
		useShallow((s) => ({
			serializedMap: s.serializedMap,
			currentNodeId: s.currentNodeId,
			visitedNodeIds: s.visitedNodeIds,
			status: s.status,
			currentAct: s.currentAct,
			playerSnapshot: s.playerSnapshot,
		})),
	);

	const { travelToNode, returnToMap, endRun, clearRun } = useRunStore(
		useShallow((s) => ({
			travelToNode: s.travelToNode,
			returnToMap: s.returnToMap,
			endRun: s.endRun,
			clearRun: s.clearRun,
		})),
	);

	// Set dungeon atmosphere on mount
	useEffect(() => {
		useUIStore.getState().setAtmosphere("mystifying_forest");
	}, []);

	// Deserialize map once
	const map = useMemo(() => {
		if (!serializedMap) return null;
		try {
			return deserializeDungeonMap(serializedMap);
		} catch {
			return null;
		}
	}, [serializedMap]);

	const currentNodeId: NodeId | null = currentNodeIdStr ? asNodeId(currentNodeIdStr) : null;

	const visitedSet = useMemo(() => new Set(visitedNodeIdStrs.map(asNodeId)), [visitedNodeIdStrs]);

	const availableNodeIds = useMemo(() => {
		if (!map) return new Set<NodeId>();
		return computeAvailableNodeIds(map, currentNodeId, visitedSet);
	}, [map, currentNodeId, visitedSet]);

	const [viewBossSignal, setViewBossSignal] = useState(0);

	const currentFloor = useMemo(() => {
		if (!map || !currentNodeId) return null;
		return map.nodes.get(currentNodeId)?.floor ?? null;
	}, [map, currentNodeId]);

	const handleNodeClick = useCallback(
		(nodeId: NodeId) => {
			if (!availableNodeIds.has(nodeId)) return;
			travelToNode(nodeId);
		},
		[availableNodeIds, travelToNode],
	);

	const handleStubContinue = useCallback(() => {
		returnToMap({});
	}, [returnToMap]);

	const handleBossContinue = useCallback(() => {
		endRun("victory");
	}, [endRun]);

	const handleEndRun = useCallback(() => {
		clearRun();
		onEndRun();
	}, [clearRun, onEndRun]);

	if (!map) {
		return (
			<div className="flex h-screen items-center justify-center text-white/60">Loading map…</div>
		);
	}

	// Determine current room node for stub modals
	const currentNode = currentNodeId ? map.nodes.get(currentNodeId) : null;

	// Show stub modal for non-combat room statuses (campfire handled by CampfireScene)
	const showStub = status === "in_event" || status === "in_shop" || status === "in_treasure";

	// Boss stub: currentNodeId is set, not yet visited, and node is boss type
	const showBossStub =
		status === "in_map" &&
		currentNodeId !== null &&
		!visitedSet.has(currentNodeId) &&
		currentNode?.type === "boss";

	const stubRoomType = showStub ? (currentNode?.type ?? "event") : null;

	return (
		<div
			className="relative flex h-screen flex-col overflow-hidden"
			style={{ fontFamily: "var(--font-pmd)" }}
		>
			<CombatBackground />

			<MapHeader
				playerSnapshot={playerSnapshot}
				currentAct={currentAct}
				currentFloor={currentFloor}
				numFloors={map.numFloors}
				onViewBoss={() => setViewBossSignal((s) => s + 1)}
				onViewDeck={() => {
					/* Phase 4.4 */
				}}
			/>

			<div className="relative flex-1 overflow-hidden">
				<MapViewport
					nodes={map.nodes}
					numColumns={map.numColumns}
					numFloors={map.numFloors}
					availableNodeIds={availableNodeIds}
					visitedNodeIds={visitedSet}
					currentNodeId={currentNodeId}
					onNodeClick={handleNodeClick}
					viewBossSignal={viewBossSignal}
				/>
			</div>

			{/* Outcome overlays */}
			{status === "victory" && <VictoryScreen onReturn={handleEndRun} />}
			{status === "defeat" && <DefeatScreen onReturn={handleEndRun} />}

			{/* Stub room modals */}
			<AnimatePresence>
				{showStub && stubRoomType && (
					<StubRoomModal roomType={stubRoomType} onContinue={handleStubContinue} />
				)}
				{showBossStub && <StubRoomModal roomType="boss" onContinue={handleBossContinue} />}
			</AnimatePresence>
		</div>
	);
}
