import { getCardDefinition } from "@core/cards/card-registry.ts";
import { useRunStore } from "@state/useRunStore.ts";
import { CardFrame } from "@ui/cards/CardFrame.tsx";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

// ---------------------------------------------------------------------------
// Animated gold counter
// ---------------------------------------------------------------------------

function useGoldCounter(target: number): number {
	const [displayed, setDisplayed] = useState(0);
	useEffect(() => {
		if (target === 0) return;
		let current = 0;
		const step = Math.max(1, Math.ceil(target / 20));
		const id = setInterval(() => {
			current = Math.min(current + step, target);
			setDisplayed(current);
			if (current >= target) clearInterval(id);
		}, 25);
		return () => clearInterval(id);
	}, [target]);
	return displayed;
}

// ---------------------------------------------------------------------------
// Card fan layout — 3 positions
// ---------------------------------------------------------------------------

const FAN_ROTATE = [-5, 0, 5];
const FAN_Y = [10, 0, 10];

// ---------------------------------------------------------------------------
// RewardScreen
// ---------------------------------------------------------------------------

export function RewardScreen() {
	const { pendingReward, completeReward } = useRunStore(
		useShallow((s) => ({ pendingReward: s.pendingReward, completeReward: s.completeReward })),
	);

	const displayedGold = useGoldCounter(pendingReward?.gold ?? 0);
	const [pickedId, setPickedId] = useState<string | null>(null);
	const [committed, setCommitted] = useState(false);

	const handlePick = useCallback(
		(cardId: string) => {
			if (committed) return;
			setPickedId(cardId);
			setCommitted(true);
			setTimeout(() => completeReward(cardId), 400);
		},
		[committed, completeReward],
	);

	const handleSkip = useCallback(() => {
		if (committed) return;
		setCommitted(true);
		setTimeout(() => completeReward(), 200);
	}, [committed, completeReward]);

	if (!pendingReward) return null;

	const { cardChoices } = pendingReward;

	return (
		<div
			className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-hidden"
			style={{ background: "rgba(0,0,0,0.88)", fontFamily: "var(--font-pmd)" }}
		>
			{/* Victory banner */}
			<motion.div
				initial={{ scale: 0.7, opacity: 0, y: -24 }}
				animate={{ scale: 1, opacity: 1, y: 0 }}
				transition={{ duration: 0.4, ease: "easeOut" }}
				className="flex flex-col items-center gap-2"
			>
				<div style={{ fontSize: 52 }}>⚔️</div>
				<h1 className="font-bold text-4xl" style={{ color: "#f59e0b" }}>
					Victory!
				</h1>
			</motion.div>

			{/* Gold reward */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.2, duration: 0.3 }}
				className="flex items-center gap-2 rounded-xl px-6 py-3"
				style={{
					background: "rgba(245,158,11,0.15)",
					border: "1px solid rgba(245,158,11,0.4)",
				}}
			>
				<span style={{ fontSize: 22 }}>💰</span>
				<span className="font-bold text-xl" style={{ color: "#fbbf24" }}>
					+{displayedGold} gold
				</span>
			</motion.div>

			{/* Card choice prompt */}
			{cardChoices.length > 0 && (
				<motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.35, duration: 0.3 }}
					className="text-sm text-white/60"
				>
					Choose a card to add to your deck
				</motion.p>
			)}

			{/* Card choices */}
			<div className="flex items-end gap-4">
				{cardChoices.map((cardId, idx) => {
					let def: ReturnType<typeof getCardDefinition> | null = null;
					try {
						def = getCardDefinition(cardId);
					} catch {
						return null;
					}

					const isPicked = pickedId === cardId;
					const isFaded = committed && !isPicked;
					const rotate = FAN_ROTATE[idx] ?? 0;
					const yBase = FAN_Y[idx] ?? 0;

					return (
						<motion.div
							key={cardId}
							initial={{ opacity: 0, y: 60, rotate: rotate * 0.5 }}
							animate={{
								opacity: isFaded ? 0 : 1,
								y: isPicked ? -24 : yBase,
								scale: isPicked ? 1.12 : 1,
								rotate,
							}}
							transition={{
								delay: isFaded || isPicked ? 0 : 0.4 + idx * 0.1,
								duration: 0.35,
								ease: "easeOut",
							}}
							style={{ transformOrigin: "bottom center" }}
						>
							<CardFrame
								definition={def}
								upgradeLevel={0}
								size="md"
								isPlayable={!committed}
								onClick={committed ? undefined : () => handlePick(cardId)}
							/>
						</motion.div>
					);
				})}
			</div>

			{/* Skip button */}
			<motion.button
				type="button"
				onClick={handleSkip}
				disabled={committed}
				initial={{ opacity: 0 }}
				animate={{ opacity: committed ? 0 : 1 }}
				transition={{ delay: 0.8, duration: 0.3 }}
				className="rounded-xl px-6 py-2 text-sm text-white/50 transition-colors hover:text-white/80"
				style={{ border: "1px solid rgba(255,255,255,0.12)" }}
			>
				Skip — keep gold only
			</motion.button>
		</div>
	);
}
