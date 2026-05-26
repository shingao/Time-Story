import type { Player } from "@core/combat/entity.ts";
import { useFloatingNumbersStore } from "@state/useFloatingNumbersStore.ts";
import { HpBar } from "@ui/shared/HpBar.tsx";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { memo, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { animationBus } from "./animationBus.ts";
import { FloatingNumber } from "./FloatingNumber.tsx";
import { StatusIcons } from "./StatusIcons.tsx";

interface PlayerStatsProps {
	readonly player: Player;
}

export const PlayerStats = memo(function PlayerStats({ player }: PlayerStatsProps) {
	const controls = useAnimationControls();

	const floatingNumbers = useFloatingNumbersStore(
		useShallow((s) => s.entries.filter((e) => e.entityId === String(player.id))),
	);

	useEffect(() => {
		const unsub = animationBus.on(`shake:${String(player.id)}`, () => {
			void controls.start({
				x: [-4, 4, -4, 4, 0],
				transition: { duration: 0.3, ease: "easeOut" },
			});
		});
		return unsub;
	}, [player.id, controls]);

	const energyFraction = player.maxEnergy > 0 ? player.energy / player.maxEnergy : 0;

	return (
		<motion.div
			animate={controls}
			className="relative flex items-center gap-4 rounded-xl px-4 py-3"
			style={{ background: "rgba(0,0,0,0.45)", fontFamily: "var(--font-pmd)" }}
			aria-label="Player stats"
		>
			{/* Floating numbers */}
			<AnimatePresence>
				{floatingNumbers.map((fn) => (
					<FloatingNumber key={fn.id} id={fn.id} amount={fn.amount} />
				))}
			</AnimatePresence>

			{/* HP section */}
			<div className="flex flex-col gap-1" style={{ minWidth: 120 }}>
				<div className="flex items-center justify-between">
					<span className="font-bold text-white text-sm">{player.name}</span>
					<span className="text-white/70 text-xs">
						{player.hp} / {player.maxHp} HP
					</span>
				</div>
				<HpBar current={player.hp} max={player.maxHp} />

				{/* Block */}
				{player.block > 0 && (
					<div className="flex items-center gap-1 text-xs text-blue-300">
						<span aria-hidden>🛡️</span>
						<span className="font-bold">{player.block} block</span>
					</div>
				)}
			</div>

			{/* Energy orb */}
			<div className="flex flex-col items-center gap-1">
				<motion.div
					className="flex h-12 w-12 items-center justify-center rounded-full font-bold text-white text-lg"
					style={{
						background: `conic-gradient(#f59e0b ${energyFraction * 360}deg, rgba(0,0,0,0.5) 0deg)`,
						boxShadow: player.energy > 0 ? "0 0 12px rgba(245,158,11,0.7)" : "none",
						transition: "box-shadow 0.3s",
					}}
					animate={{ scale: [1, 1.05, 1] }}
					transition={{ duration: 0.4, ease: "easeOut" }}
					key={player.energy}
				>
					{player.energy}
				</motion.div>
				<span className="text-[9px] uppercase tracking-wide text-white/50">
					/ {player.maxEnergy}
				</span>
			</div>

			{/* Statuses */}
			{(player.statuses.length > 0 || player.buffs.length > 0) && (
				<StatusIcons statuses={player.statuses} buffs={player.buffs} />
			)}
		</motion.div>
	);
});
