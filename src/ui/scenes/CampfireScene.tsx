import type { CampfireOption } from "@core/campfire/campfire-options.ts";
import { getCampfireOptions } from "@core/campfire/campfire-options.ts";
import { resolveCard } from "@core/cards/card-definition.ts";
import { getCardDefinition } from "@core/cards/card-registry.ts";
import { useRunStore } from "@state/useRunStore.ts";
import { useUIStore } from "@state/useUIStore.ts";
import { CombatBackground } from "@ui/combat/CombatBackground.tsx";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "choosing" | "train-selecting" | "train-confirming";

interface DeckCardInfo {
	instanceId: string;
	defId: string;
	name: string;
	upgradeLevel: 0 | 1 | 2;
	isUpgradable: boolean;
}

// ---------------------------------------------------------------------------
// KangaskhanStatue — breathing animation with image fallback
// ---------------------------------------------------------------------------

function KangaskhanStatue() {
	const [imgError, setImgError] = useState(false);

	return (
		<motion.div
			animate={{ scale: [1, 1.02, 1] }}
			transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
			style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220 }}
		>
			{imgError ? (
				<div
					style={{
						width: 140,
						height: 200,
						borderRadius: "48% 48% 44% 44%",
						background:
							"radial-gradient(ellipse at 50% 40%, #FF8C42 0%, #C45E00 55%, #7A3600 100%)",
						opacity: 0.55,
						filter: "blur(1px)",
						boxShadow: "0 0 60px rgba(255,140,66,0.25)",
					}}
				/>
			) : (
				<img
					src="/src/assets/sprites/kangaskhan-statue.png"
					alt="Kangaskhan Statue"
					onError={() => setImgError(true)}
					style={{
						height: 200,
						objectFit: "contain",
						filter:
							"drop-shadow(0 0 40px rgba(255,140,66,0.35)) drop-shadow(0 0 80px rgba(255,140,66,0.15))",
					}}
				/>
			)}
		</motion.div>
	);
}

// ---------------------------------------------------------------------------
// ChoiceCard
// ---------------------------------------------------------------------------

const ICON: Record<CampfireOption["iconKey"], string> = {
	heart: "♥",
	sparkle: "✦",
	eye: "◉",
};

// Vertical offsets to create a gentle arc (outer cards slightly lower)
const ARC_OFFSETS = [12, 0, 12];

interface ChoiceCardProps {
	readonly option: CampfireOption;
	readonly isAvailable: boolean;
	readonly activating: boolean;
	readonly fadingOut: boolean;
	readonly arcOffset: number;
	readonly onClick: () => void;
}

function ChoiceCard({
	option,
	isAvailable,
	activating,
	fadingOut,
	arcOffset,
	onClick,
}: ChoiceCardProps) {
	const disabled = !isAvailable;

	return (
		<motion.button
			type="button"
			onClick={disabled ? undefined : onClick}
			disabled={disabled}
			animate={{
				opacity: fadingOut ? 0 : disabled ? 0.38 : 1,
				y: fadingOut ? 30 : arcOffset,
				scale: activating ? 1.1 : 1,
				boxShadow: activating ? `0 0 40px ${option.themeColor}70` : "0 0 0px transparent",
			}}
			transition={{ duration: 0.32, ease: "easeOut" }}
			style={{
				width: 176,
				padding: "24px 14px",
				borderRadius: 20,
				background: disabled ? "rgba(255,255,255,0.04)" : `${option.themeColor}12`,
				border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : `${option.themeColor}45`}`,
				cursor: disabled ? "default" : "pointer",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 14,
				backdropFilter: "blur(6px)",
				fontFamily: "var(--font-pmd)",
			}}
			whileHover={
				!disabled
					? {
							y: arcOffset - 8,
							scale: 1.04,
							boxShadow: `0 8px 32px ${option.themeColor}50`,
						}
					: undefined
			}
			whileTap={!disabled ? { scale: 0.97 } : undefined}
		>
			<div
				style={{
					width: 56,
					height: 56,
					borderRadius: "50%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 26,
					background: `${option.themeColor}1e`,
					color: disabled ? "rgba(255,255,255,0.25)" : option.themeColor,
					border: `1px solid ${disabled ? "rgba(255,255,255,0.06)" : `${option.themeColor}40`}`,
				}}
			>
				{ICON[option.iconKey]}
			</div>
			<div style={{ textAlign: "center" }}>
				<div
					style={{
						fontSize: 15,
						fontWeight: 700,
						color: disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.95)",
						marginBottom: 6,
					}}
				>
					{option.label}
				</div>
				<div
					style={{
						fontSize: 11,
						color: disabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.58)",
						lineHeight: 1.5,
					}}
				>
					{option.description}
				</div>
			</div>
		</motion.button>
	);
}

// ---------------------------------------------------------------------------
// TrainCardTile
// ---------------------------------------------------------------------------

function TrainCardTile({
	card,
	onClick,
}: {
	readonly card: DeckCardInfo;
	readonly onClick: () => void;
}) {
	const stars = card.upgradeLevel === 2 ? "★★" : card.upgradeLevel === 1 ? "★" : "";
	const levelLabel =
		card.upgradeLevel === 2 ? "Maxed" : card.upgradeLevel === 1 ? "Upgraded" : "Base";

	return (
		<motion.button
			type="button"
			onClick={card.isUpgradable ? onClick : undefined}
			disabled={!card.isUpgradable}
			title={card.isUpgradable ? undefined : "Already at max level"}
			whileHover={card.isUpgradable ? { scale: 1.06, y: -4 } : undefined}
			whileTap={card.isUpgradable ? { scale: 0.96 } : undefined}
			style={{
				width: 116,
				padding: "12px 8px",
				borderRadius: 12,
				background: card.isUpgradable ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)",
				border: `1px solid ${card.isUpgradable ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)"}`,
				cursor: card.isUpgradable ? "pointer" : "default",
				filter: card.isUpgradable ? undefined : "grayscale(0.8)",
				opacity: card.isUpgradable ? 1 : 0.32,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 6,
				fontFamily: "var(--font-pmd)",
			}}
		>
			<div style={{ fontSize: 12, fontWeight: 600, color: "white" }}>
				{card.name} {stars}
			</div>
			<div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{levelLabel}</div>
		</motion.button>
	);
}

// ---------------------------------------------------------------------------
// CampfireScene
// ---------------------------------------------------------------------------

export function CampfireScene() {
	const { playerSnapshot, completeCampfire } = useRunStore(
		useShallow((s) => ({
			playerSnapshot: s.playerSnapshot,
			completeCampfire: s.completeCampfire,
		})),
	);

	const [phase, setPhase] = useState<Phase>("choosing");
	const [activatingId, setActivatingId] = useState<string | null>(null);
	const [selectedCardInstanceId, setSelectedCardInstanceId] = useState<string | null>(null);
	// Stored in ref to avoid setState(fn) being treated as an updater function
	const trainCallbackRef = useRef<((instanceId: string) => typeof playerSnapshot) | null>(null);

	useEffect(() => {
		useUIStore.getState().setAtmosphere("campfire");
	}, []);

	const ctx = useMemo(() => ({ playerSnapshot }), [playerSnapshot]);
	const options = useMemo(() => getCampfireOptions(), []);

	// Build deck card list for the Train phase
	const deckCards = useMemo<DeckCardInfo[]>(
		() =>
			playerSnapshot.deckCardIds.map((defId, i) => {
				const instanceId = `${defId}-${i}`;
				const upgradeLevel = (playerSnapshot.cardUpgrades[instanceId] ?? 0) as 0 | 1 | 2;
				let name = defId;
				try {
					const def = getCardDefinition(defId);
					name = resolveCard(def, upgradeLevel).name;
				} catch {
					/* unknown card — keep raw id */
				}
				return { instanceId, defId, name, upgradeLevel, isUpgradable: upgradeLevel < 2 };
			}),
		[playerSnapshot],
	);

	// Derive confirmation info from selected card
	const confirmInfo = useMemo(() => {
		if (!selectedCardInstanceId) return null;
		const card = deckCards.find((c) => c.instanceId === selectedCardInstanceId);
		if (!card) return null;
		const nextLevel = Math.min(card.upgradeLevel + 1, 2) as 0 | 1 | 2;
		try {
			const def = getCardDefinition(card.defId);
			return {
				card,
				currentName: resolveCard(def, card.upgradeLevel).name,
				upgradedName: resolveCard(def, nextLevel).name,
			};
		} catch {
			return { card, currentName: card.name, upgradedName: `${card.name}+` };
		}
	}, [selectedCardInstanceId, deckCards]);

	const handleOptionClick = useCallback(
		(option: CampfireOption) => {
			if (!option.isAvailable(ctx)) return;
			setActivatingId(option.id);
			const result = option.execute(ctx);

			if (result.kind === "instant") {
				setTimeout(() => {
					completeCampfire(result.updatedPlayer);
				}, 380);
			} else {
				trainCallbackRef.current = result.onCardSelected;
				setTimeout(() => {
					setActivatingId(null);
					setPhase("train-selecting");
				}, 380);
			}
		},
		[ctx, completeCampfire],
	);

	const handleCardSelect = useCallback((instanceId: string) => {
		setSelectedCardInstanceId(instanceId);
		setPhase("train-confirming");
	}, []);

	const handleConfirmUpgrade = useCallback(() => {
		if (!trainCallbackRef.current || !selectedCardInstanceId) return;
		const updatedPlayer = trainCallbackRef.current(selectedCardInstanceId);
		completeCampfire(updatedPlayer);
	}, [selectedCardInstanceId, completeCampfire]);

	const handleCancelConfirm = useCallback(() => {
		setSelectedCardInstanceId(null);
		setPhase("train-selecting");
	}, []);

	const handleBackToChoosing = useCallback(() => {
		trainCallbackRef.current = null;
		setSelectedCardInstanceId(null);
		setActivatingId(null);
		setPhase("choosing");
	}, []);

	return (
		<div
			className="relative flex h-screen flex-col items-center justify-center overflow-hidden"
			style={{ fontFamily: "var(--font-pmd)" }}
		>
			<CombatBackground />

			{/* ── Choosing phase ── */}
			<AnimatePresence mode="wait">
				{phase === "choosing" && (
					<motion.div
						key="choosing"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.25 }}
						className="flex flex-col items-center gap-8"
						style={{ zIndex: 10 }}
					>
						{/* Title */}
						<div className="text-center">
							<h1
								className="font-bold text-2xl"
								style={{ color: "#FF8C42", textShadow: "0 2px 16px rgba(255,140,66,0.4)" }}
							>
								Kangaskhan Rest Spot
							</h1>
							<p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
								The ancient statue radiates a warm, comforting glow.
							</p>
						</div>

						{/* Statue */}
						<KangaskhanStatue />

						{/* Choice cards */}
						<div className="flex items-start gap-5">
							{options.map((option, idx) => (
								<ChoiceCard
									key={option.id}
									option={option}
									isAvailable={option.isAvailable(ctx)}
									activating={activatingId === option.id}
									fadingOut={activatingId !== null && activatingId !== option.id}
									arcOffset={ARC_OFFSETS[idx] ?? 0}
									onClick={() => handleOptionClick(option)}
								/>
							))}
						</div>
					</motion.div>
				)}

				{/* ── Train — card selection ── */}
				{phase === "train-selecting" && (
					<motion.div
						key="train-selecting"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.28 }}
						className="flex w-full max-w-2xl flex-col gap-4"
						style={{ zIndex: 10, padding: "0 24px" }}
					>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={handleBackToChoosing}
								className="text-sm"
								style={{ color: "rgba(255,255,255,0.45)", cursor: "pointer" }}
							>
								← Back
							</button>
							<h2 className="font-bold text-lg" style={{ color: "#93c5fd" }}>
								Choose a card to upgrade
							</h2>
						</div>

						<div
							style={{
								maxHeight: "60vh",
								overflowY: "auto",
								paddingRight: 4,
							}}
						>
							<div
								style={{
									display: "flex",
									flexWrap: "wrap",
									gap: 10,
									justifyContent: "center",
									padding: "8px 0",
								}}
							>
								{deckCards.map((card) => (
									<TrainCardTile
										key={card.instanceId}
										card={card}
										onClick={() => handleCardSelect(card.instanceId)}
									/>
								))}
							</div>
						</div>
					</motion.div>
				)}

				{/* ── Train — confirmation ── */}
				{phase === "train-confirming" && confirmInfo && (
					<motion.div
						key="train-confirming"
						initial={{ opacity: 0, scale: 0.88 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.92 }}
						transition={{ duration: 0.25, ease: "easeOut" }}
						className="flex flex-col items-center gap-6 rounded-2xl p-10 text-center"
						style={{
							zIndex: 10,
							background: "rgba(12,12,22,0.97)",
							border: "1px solid rgba(147,197,253,0.2)",
							minWidth: 320,
							maxWidth: 400,
						}}
					>
						<h3 className="font-bold text-xl text-white">Upgrade Card?</h3>

						<div style={{ fontSize: 14 }}>
							<span style={{ color: "rgba(255,255,255,0.65)" }}>{confirmInfo.currentName}</span>
							<span style={{ color: "rgba(255,255,255,0.35)", margin: "0 12px" }}>→</span>
							<span style={{ color: "#93c5fd", fontWeight: 700 }}>{confirmInfo.upgradedName}</span>
						</div>

						<div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
							Level {confirmInfo.card.upgradeLevel} → Level{" "}
							{Math.min(confirmInfo.card.upgradeLevel + 1, 2)}
						</div>

						<div className="flex gap-3">
							<motion.button
								type="button"
								onClick={handleConfirmUpgrade}
								className="rounded-xl px-7 py-2.5 font-semibold text-sm text-white"
								style={{
									background: "rgba(147,197,253,0.8)",
									border: "1px solid rgba(255,255,255,0.2)",
									color: "#0c1830",
								}}
								whileHover={{ scale: 1.04 }}
								whileTap={{ scale: 0.97 }}
							>
								Confirm
							</motion.button>
							<motion.button
								type="button"
								onClick={handleCancelConfirm}
								className="rounded-xl px-7 py-2.5 text-sm"
								style={{
									background: "rgba(255,255,255,0.07)",
									border: "1px solid rgba(255,255,255,0.12)",
									color: "rgba(255,255,255,0.6)",
								}}
								whileHover={{ scale: 1.04 }}
								whileTap={{ scale: 0.97 }}
							>
								Cancel
							</motion.button>
						</div>

						<button
							type="button"
							onClick={handleBackToChoosing}
							style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", cursor: "pointer" }}
						>
							← Back to choices
						</button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
