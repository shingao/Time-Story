import type { Enemy } from "@core/combat/entity.ts";
import type { PokemonType } from "@core/types/pokemon-types.ts";
import { useFloatingNumbersStore } from "@state/useFloatingNumbersStore.ts";
import { HpBar } from "@ui/shared/HpBar.tsx";
import { TYPE_COLORS } from "@ui/shared/typeColors.ts";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { memo, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { animationBus } from "./animationBus.ts";
import { FloatingNumber } from "./FloatingNumber.tsx";
import { IntentBadge } from "./IntentBadge.tsx";
import { StatusIcons } from "./StatusIcons.tsx";

// ---------------------------------------------------------------------------
// Blob shapes — organic CSS border-radius per type group
// ---------------------------------------------------------------------------

const TYPE_BLOB_RADIUS: Partial<Record<PokemonType, string>> = {
	fire: "60% 40% 60% 40% / 40% 60% 40% 60%",
	dragon: "60% 40% 60% 40% / 40% 60% 40% 60%",
	water: "50% 50% 70% 30% / 40% 60% 40% 60%",
	ice: "50% 50% 70% 30% / 40% 60% 40% 60%",
	grass: "40% 60% 70% 30% / 40% 50% 60% 50%",
	bug: "40% 60% 70% 30% / 40% 50% 60% 50%",
	electric: "20% 80% 20% 80% / 80% 20% 80% 20%",
	psychic: "70% 30% 50% 50% / 30% 70% 50% 50%",
	fairy: "70% 30% 50% 50% / 30% 70% 50% 50%",
	normal: "45% 55% 50% 50% / 45% 45% 55% 55%",
	poison: "30% 70% 70% 30% / 50% 30% 70% 50%",
	ghost: "30% 70% 70% 30% / 50% 30% 70% 50%",
	ground: "25% 25% 20% 20% / 20% 20% 25% 25%",
	rock: "25% 25% 20% 20% / 20% 20% 25% 25%",
	fighting: "35% 65% 35% 65% / 65% 35% 65% 35%",
	steel: "35% 65% 35% 65% / 65% 35% 65% 35%",
	flying: "70% 30% 30% 70% / 50% 70% 30% 50%",
	dark: "40% 60% 60% 40% / 60% 40% 60% 40%",
};

const DEFAULT_BLOB_RADIUS = "45% 55% 50% 50% / 45% 45% 55% 55%";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EnemySpriteProps {
	readonly enemy: Enemy;
	readonly isTargeted: boolean;
	readonly onClick: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const EnemySprite = memo(function EnemySprite({
	enemy,
	isTargeted,
	onClick,
}: EnemySpriteProps) {
	const controls = useAnimationControls();
	const isDead = enemy.hp <= 0;

	const floatingNumbers = useFloatingNumbersStore(
		useShallow((s) => s.entries.filter((e) => e.entityId === String(enemy.id))),
	);

	// Subscribe to animation bus events for this enemy
	useEffect(() => {
		const unsubShake = animationBus.on(`shake:${String(enemy.id)}`, () => {
			void controls.start({
				x: [-5, 5, -5, 5, 0],
				transition: { duration: 0.35, ease: "easeOut" },
			});
		});
		return unsubShake;
	}, [enemy.id, controls]);

	const primaryType = enemy.types[0] ?? "normal";
	const blobRadius = TYPE_BLOB_RADIUS[primaryType] ?? DEFAULT_BLOB_RADIUS;
	const typeColor = TYPE_COLORS[primaryType];

	return (
		<AnimatePresence>
			{!isDead && (
				<motion.div
					key={String(enemy.id)}
					initial={{ opacity: 0, scale: 0.8, y: 20 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.6, y: -30 }}
					transition={{ type: "spring", stiffness: 260, damping: 22 }}
					className="relative flex flex-col items-center gap-2"
					style={{ minWidth: 160 }}
				>
					{/* Intent badge (floats above sprite) */}
					<IntentBadge intent={enemy.intent} />

					{/* Sprite tile */}
					<motion.div
						animate={controls}
						onClick={onClick}
						role="button"
						tabIndex={0}
						aria-label={`Target ${enemy.name}`}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") onClick();
						}}
						className="relative flex cursor-pointer items-center justify-center transition-all"
						style={{
							width: 120,
							height: 120,
							borderRadius: blobRadius,
							background: `radial-gradient(circle at 35% 35%, ${typeColor}cc, ${typeColor}66)`,
							border: isTargeted ? "3px solid #fff" : `2px solid ${typeColor}99`,
							boxShadow: isTargeted
								? `0 0 20px 4px rgba(255,255,255,0.5), 0 4px 16px rgba(0,0,0,0.6)`
								: "0 4px 16px rgba(0,0,0,0.5)",
							transition: "box-shadow 0.2s, border-color 0.2s",
						}}
						whileHover={{ scale: 1.06 }}
						whileTap={{ scale: 0.95 }}
					>
						{/* Silhouette inner highlight */}
						<div
							className="absolute inset-0 opacity-20"
							style={{
								borderRadius: blobRadius,
								background: `radial-gradient(circle at 30% 30%, white, transparent 60%)`,
							}}
						/>

						{/* Enemy name */}
						<span
							className="relative z-10 text-center font-bold text-white/90 text-sm leading-tight drop-shadow"
							style={{ fontFamily: "var(--font-pmd)", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
						>
							{enemy.name}
						</span>

						{/* Floating damage numbers */}
						{floatingNumbers.map((fn) => (
							<FloatingNumber key={fn.id} id={fn.id} amount={fn.amount} />
						))}
					</motion.div>

					{/* Status icons */}
					{(enemy.statuses.length > 0 || enemy.buffs.length > 0) && (
						<StatusIcons statuses={enemy.statuses} buffs={enemy.buffs} />
					)}

					{/* Block */}
					{enemy.block > 0 && (
						<div className="flex items-center gap-1 rounded-full bg-blue-900/70 px-2 py-0.5 text-xs text-white">
							<span aria-hidden>🛡️</span>
							<span className="font-bold">{enemy.block}</span>
						</div>
					)}

					{/* Type badges */}
					<div className="flex gap-1">
						{enemy.types.map((t) => (
							<span
								key={t}
								className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
								style={{ backgroundColor: TYPE_COLORS[t] }}
							>
								{t}
							</span>
						))}
					</div>

					{/* HP bar */}
					<div className="w-full px-1">
						<HpBar current={enemy.hp} max={enemy.maxHp} />
						<p className="mt-0.5 text-center text-[10px] text-white/70">
							{enemy.hp} / {enemy.maxHp}
						</p>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
});
