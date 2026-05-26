import type { CombatPhase } from "@core/combat/effects/effect-handler.ts";
import { motion } from "framer-motion";
import { memo, useEffect } from "react";

interface EndTurnButtonProps {
	readonly phase: CombatPhase;
	readonly hasUnusedEnergy: boolean;
	readonly onEndTurn: () => void;
}

export const EndTurnButton = memo(function EndTurnButton({
	phase,
	hasUnusedEnergy,
	onEndTurn,
}: EndTurnButtonProps) {
	const isPlayerTurn = phase === "PLAYER_TURN";
	const isEnemyTurn = phase === "ENEMY_TURN";

	// Spacebar shortcut — only on player turn
	useEffect(() => {
		if (!isPlayerTurn) return;
		const handler = (e: KeyboardEvent) => {
			if (e.code === "Space" && !e.repeat) {
				e.preventDefault();
				onEndTurn();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isPlayerTurn, onEndTurn]);

	const bgColor = isEnemyTurn
		? "rgba(60,60,60,0.8)"
		: hasUnusedEnergy
			? "rgba(180,30,30,0.9)"
			: "rgba(20,120,60,0.9)";

	const label = isEnemyTurn ? "Enemy Turn…" : "End Turn";

	return (
		<motion.button
			type="button"
			onClick={isPlayerTurn ? onEndTurn : undefined}
			disabled={!isPlayerTurn}
			className="flex flex-col items-center rounded-xl px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
			style={{
				background: bgColor,
				fontFamily: "var(--font-pmd)",
				minWidth: 110,
				boxShadow: isPlayerTurn ? "0 4px 16px rgba(0,0,0,0.5)" : "none",
				transition: "background 0.3s",
			}}
			whileHover={isPlayerTurn ? { scale: 1.05, y: -2 } : undefined}
			whileTap={isPlayerTurn ? { scale: 0.96 } : undefined}
			aria-label={`${label} (Space)`}
			aria-disabled={!isPlayerTurn}
		>
			<span className="text-sm">{label}</span>
			{isPlayerTurn && <span className="mt-0.5 text-[10px] font-normal opacity-60">Space</span>}
		</motion.button>
	);
});
