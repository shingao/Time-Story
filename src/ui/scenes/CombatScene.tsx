import { getCardDefinition } from "@core/cards/card-registry.ts";
import { useCombatStore } from "@state/useCombatStore.ts";
import { useFloatingNumbersStore } from "@state/useFloatingNumbersStore.ts";
import { useUIStore } from "@state/useUIStore.ts";
import { DeckPile } from "@ui/cards/DeckPile.tsx";
import { Hand } from "@ui/cards/Hand.tsx";
import { AnimationDriver } from "@ui/combat/AnimationDriver.tsx";
import { CombatBackground } from "@ui/combat/CombatBackground.tsx";
import { EndTurnButton } from "@ui/combat/EndTurnButton.tsx";
import { EnemyArea } from "@ui/combat/EnemyArea.tsx";
import { LoseScreen } from "@ui/combat/LoseScreen.tsx";
import { PlayerStats } from "@ui/combat/PlayerStats.tsx";
import { WinScreen } from "@ui/combat/WinScreen.tsx";
import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePlayableIds(
	hand: readonly { instanceId: string; definitionId: string }[],
	playerEnergy: number,
): ReadonlySet<string> {
	const playable = new Set<string>();
	for (const inst of hand) {
		try {
			const def = getCardDefinition(inst.definitionId);
			if (def.energyCost <= playerEnergy) {
				playable.add(inst.instanceId);
			}
		} catch {
			// unknown card — skip
		}
	}
	return playable;
}

// ---------------------------------------------------------------------------
// CombatScene
// ---------------------------------------------------------------------------

interface CombatSceneProps {
	readonly onReturn: () => void;
	readonly onRunWin?: (finalHp: number) => void;
	readonly onRunLose?: () => void;
}

export function CombatScene({ onReturn, onRunWin, onRunLose }: CombatSceneProps) {
	// Store slices — shallow selectors prevent re-renders on unrelated changes
	const { combatState, phase, turnNumber } = useCombatStore(
		useShallow((s) => ({
			combatState: s.combatState,
			phase: s.phase,
			turnNumber: s.turnNumber,
		})),
	);
	const { playCard, endTurn, reset } = useCombatStore(
		useShallow((s) => ({ playCard: s.playCard, endTurn: s.endTurn, reset: s.reset })),
	);

	const { clearSelection, selectCard, animationSpeed, setAnimationSpeed } = useUIStore(
		useShallow((s) => ({
			clearSelection: s.clearSelection,
			selectCard: s.selectCard,
			animationSpeed: s.animationSpeed,
			setAnimationSpeed: s.setAnimationSpeed,
		})),
	);

	const clearNumbers = useFloatingNumbersStore((s) => s.clear);

	// Set combat atmosphere on mount
	useEffect(() => {
		useUIStore.getState().setAtmosphere("mystifying_forest");
	}, []);

	// Local targeting state — which card is staged for targeting
	const [targetingCardId, setTargetingCardId] = useState<string | null>(null);

	const handleCombatEnd = useCallback(() => {
		reset();
		clearNumbers();
		clearSelection();
		setTargetingCardId(null);
		onReturn();
	}, [reset, clearNumbers, clearSelection, onReturn]);

	// Run-mode: called from WinScreen BEFORE reset so we still have final HP
	const handleWin = useCallback(() => {
		if (onRunWin && combatState) {
			onRunWin(combatState.player.hp);
		}
		handleCombatEnd();
	}, [onRunWin, combatState, handleCombatEnd]);

	// Run-mode: called from LoseScreen BEFORE reset
	const handleLose = useCallback(() => {
		if (onRunLose) {
			onRunLose();
		}
		handleCombatEnd();
	}, [onRunLose, handleCombatEnd]);

	const handleCardClick = useCallback(
		(instanceId: string) => {
			if (phase !== "PLAYER_TURN") return;

			const inst = combatState?.hand.find((c) => c.instanceId === instanceId);
			if (!inst) return;

			let def: ReturnType<typeof getCardDefinition>;
			try {
				def = getCardDefinition(inst.definitionId);
			} catch {
				return;
			}

			// Self-targeting or no-target cards → play immediately
			if (def.target === "self" || def.target === "none") {
				const result = playCard(instanceId, undefined);
				if (result.played) {
					setTargetingCardId(null);
					clearSelection();
				}
				return;
			}

			// Toggle selection for enemy-targeting cards
			if (targetingCardId === instanceId) {
				setTargetingCardId(null);
				clearSelection();
			} else {
				setTargetingCardId(instanceId);
				selectCard(instanceId);
			}
		},
		[phase, combatState, playCard, targetingCardId, selectCard, clearSelection],
	);

	const handleEnemyClick = useCallback(
		(enemyId: string) => {
			if (!targetingCardId) return;
			const result = playCard(targetingCardId, enemyId);
			if (result.played) {
				setTargetingCardId(null);
				clearSelection();
			}
		},
		[targetingCardId, playCard, clearSelection],
	);

	const handleCardDragEnd = useCallback(
		(instanceId: string, x: number, y: number) => {
			if (phase !== "PLAYER_TURN") return;

			// Determine which enemy (if any) was under the drop point
			const elements = document.elementsFromPoint(x, y);
			let droppedEnemyId: string | null = null;
			for (const el of elements) {
				const id = (el as HTMLElement).dataset?.enemyId;
				if (id) {
					droppedEnemyId = id;
					break;
				}
			}
			if (!droppedEnemyId) return;

			const inst = combatState?.hand.find((c) => c.instanceId === instanceId);
			if (!inst) return;

			let def: ReturnType<typeof getCardDefinition>;
			try {
				def = getCardDefinition(inst.definitionId);
			} catch {
				return;
			}

			// Only play enemy-targeting cards via drag; self/none cards use click
			if (def.target !== "enemy") return;

			const result = playCard(instanceId, droppedEnemyId);
			if (result.played) {
				setTargetingCardId(null);
				clearSelection();
			}
		},
		[phase, combatState, playCard, clearSelection],
	);

	const handleEndTurn = useCallback(() => {
		setTargetingCardId(null);
		clearSelection();
		endTurn();
	}, [endTurn, clearSelection]);

	// Bail out if combat not initialised
	if (!combatState) {
		return (
			<div className="flex h-screen items-center justify-center text-white/60">
				No active combat.
			</div>
		);
	}

	const { player, enemies, hand, drawPile, discardPile } = combatState;
	const playableIds = computePlayableIds(hand, player.energy);
	const hasUnusedEnergy = player.energy > 0;

	return (
		<div
			className="relative flex h-screen flex-col overflow-hidden"
			style={{ fontFamily: "var(--font-pmd)" }}
		>
			<CombatBackground />

			{/* Turn number indicator */}
			<div
				className="absolute right-4 top-4 z-10 rounded-full px-3 py-1 text-[11px] text-white/50"
				style={{ background: "rgba(0,0,0,0.4)" }}
			>
				Turn {turnNumber + 1}
			</div>

			{/* Speed controls */}
			<div className="absolute left-4 top-4 z-10 flex gap-1">
				{(["normal", "fast", "instant"] as const).map((speed) => (
					<button
						type="button"
						key={speed}
						onClick={() => setAnimationSpeed(speed)}
						className="rounded px-2 py-0.5 text-[10px] font-semibold capitalize text-white/70 transition-colors"
						style={{
							background: animationSpeed === speed ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.4)",
							border:
								animationSpeed === speed
									? "1px solid rgba(255,255,255,0.4)"
									: "1px solid transparent",
						}}
						aria-label={`Animation speed: ${speed}`}
						aria-pressed={animationSpeed === speed}
					>
						{speed === "normal" ? "1×" : speed === "fast" ? "2×" : "⚡"}
					</button>
				))}
			</div>

			{/* Enemy area — top half */}
			<div className="relative z-10 flex-1">
				<EnemyArea
					enemies={enemies}
					targetingActive={targetingCardId !== null}
					onEnemyClick={handleEnemyClick}
				/>
			</div>

			{/* Divider */}
			<div className="relative z-10 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

			{/* Player area — bottom half */}
			<div
				className="relative z-10 flex flex-col gap-3 px-4 pb-4 pt-3"
				style={{ background: "rgba(0,0,0,0.3)" }}
			>
				{/* Stats row */}
				<div className="flex items-center justify-between gap-4">
					<PlayerStats player={player} />

					{/* Relic tray placeholder — TODO(phase-5.1): replace with RelicTray */}
					<div
						className="flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] text-white/30"
						style={{ border: "1px dashed rgba(255,255,255,0.12)" }}
					>
						✦ Relics
					</div>

					{/* Pile buttons + End Turn */}
					<div className="flex items-center gap-3">
						<DeckPile type="draw" count={drawPile.length} />
						<DeckPile type="discard" count={discardPile.length} />
						<EndTurnButton
							phase={phase}
							hasUnusedEnergy={hasUnusedEnergy}
							onEndTurn={handleEndTurn}
						/>
					</div>
				</div>

				{/* Hand */}
				<div className="flex items-end justify-center">
					<Hand
						cards={hand}
						playableIds={playableIds}
						selectedId={targetingCardId ?? undefined}
						onCardClick={handleCardClick}
						onCardDragEnd={handleCardDragEnd}
					/>
				</div>

				{/* Targeting hint */}
				{targetingCardId !== null && (
					<p className="text-center text-[11px] text-white/50">
						Select an enemy to play the card — or click the card again to cancel
					</p>
				)}
			</div>

			{/* Headless animation consumer */}
			<AnimationDriver />

			{/* Outcome overlays */}
			{phase === "WIN" && <WinScreen onContinue={onRunWin ? handleWin : handleCombatEnd} />}
			{phase === "LOSE" && <LoseScreen onReturn={onRunLose ? handleLose : handleCombatEnd} />}
		</div>
	);
}
