import { resetSpawnCounter } from "@core/enemies/enemy-registry.ts";
import { createRunCombat } from "@core/run/runCombatFactory.ts";
import { useCombatStore } from "@state/useCombatStore.ts";
import { useRunStore } from "@state/useRunStore.ts";
import { useCallback, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { CombatScene } from "./CombatScene.tsx";

export function RunCombatAdapter() {
	const { starterId, currentNodeId, nodeEncounters, playerSnapshot } = useRunStore(
		useShallow((s) => ({
			starterId: s.starterId,
			currentNodeId: s.currentNodeId,
			nodeEncounters: s.nodeEncounters,
			playerSnapshot: s.playerSnapshot,
		})),
	);

	const { startReward, endRun } = useRunStore(
		useShallow((s) => ({ startReward: s.startReward, endRun: s.endRun })),
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
		startReward(finalHp);
		// RunStore.status is now "in_reward" — RunContainer renders RewardScreen.
	};

	const handleRunLose = () => {
		endRun("defeat");
		// RunStore.status is now "defeat" — MapScene shows DefeatScreen.
		// Its "Return to Guild" button calls onEndRun via MapScene.handleEndRun.
	};

	// Two combat contexts:
	//   Standalone (DevMenu, no run): CombatScene passes onReturn directly to nav away.
	//   Run-mode (this adapter): win/lose hooks already updated RunStore; routing is driven
	//   by RunStore.status, so no explicit navigation is needed after the hooks run.
	const handleCombatReturn = useCallback(() => {}, []);

	return (
		<CombatScene onReturn={handleCombatReturn} onRunWin={handleRunWin} onRunLose={handleRunLose} />
	);
}
