import { resetSpawnCounter } from "@core/enemies/enemy-registry.ts";
import { createRunCombat } from "@core/run/runCombatFactory.ts";
import { useCombatStore } from "@state/useCombatStore.ts";
import { useRunStore } from "@state/useRunStore.ts";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { CombatScene } from "./CombatScene.tsx";

interface RunCombatAdapterProps {
	readonly onEndRun: () => void;
}

export function RunCombatAdapter({ onEndRun }: RunCombatAdapterProps) {
	const { starterId, currentNodeId, nodeEncounters, playerSnapshot } = useRunStore(
		useShallow((s) => ({
			starterId: s.starterId,
			currentNodeId: s.currentNodeId,
			nodeEncounters: s.nodeEncounters,
			playerSnapshot: s.playerSnapshot,
		})),
	);

	const { returnToMap, endRun } = useRunStore(
		useShallow((s) => ({ returnToMap: s.returnToMap, endRun: s.endRun })),
	);

	const initCombat = useCombatStore((s) => s.initCombat);

	// Capture mount-time values in refs so the one-shot effect doesn't need
	// them in its dependency array (we intentionally only init combat once).
	const mountRef = useRef({ starterId, currentNodeId, nodeEncounters, playerSnapshot, initCombat });

	// Initialize combat from run state — runs exactly once on mount
	useEffect(() => {
		const {
			starterId: sid,
			currentNodeId: nid,
			nodeEncounters: enc,
			playerSnapshot: snap,
			initCombat: init,
		} = mountRef.current;
		if (!sid || !nid) return;
		const enemyId = enc[nid] ?? "pidgey";
		const seed = (Date.now() ^ 0xdeadbeef) >>> 0;
		resetSpawnCounter();
		const state = createRunCombat(snap, sid, enemyId, seed);
		init(state, seed);
	}, []); // empty array is intentional — mount-only init

	const handleRunWin = (finalHp: number) => {
		returnToMap({ finalHp });
	};

	const handleRunLose = () => {
		endRun("defeat");
		onEndRun();
	};

	return <CombatScene onReturn={onEndRun} onRunWin={handleRunWin} onRunLose={handleRunLose} />;
}
