import type { CardDefinition, CardInstance } from "@core/cards/card-definition.ts";
import { getCardDefinition } from "@core/cards/card-registry.ts";
import { AnimatePresence, motion } from "framer-motion";
import { CardFrame } from "./CardFrame.tsx";

// ---------------------------------------------------------------------------
// Fan layout constants
// ---------------------------------------------------------------------------

const MAX_FAN_DEG = 18; // total arc in degrees for max-hand spread
const ARC_DROP_PX = 28; // px drop from center to edge (parabola)
const CARD_OVERLAP_PX = 46; // horizontal gap between card centres at sm size

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HandProps {
	readonly cards: readonly CardInstance[];
	/** Set of instanceIds the player is currently allowed to play */
	readonly playableIds?: ReadonlySet<string>;
	/** Currently selected card instanceId */
	readonly selectedId?: string;
	/** Called when a card is clicked */
	readonly onCardClick?: (instanceId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Hand({ cards, playableIds, selectedId, onCardClick }: HandProps) {
	const n = cards.length;

	return (
		<section
			className="relative flex items-end justify-center"
			style={{
				height: 220,
				// wide enough to hold all cards even if no wrapping
				minWidth: Math.max(n * CARD_OVERLAP_PX + 84, 300),
			}}
			aria-label={`Hand: ${n} card${n !== 1 ? "s" : ""}`}
		>
			<AnimatePresence initial={false}>
				{cards.map((inst, i) => {
					// Normalised position: -1 (leftmost) to +1 (rightmost)
					const t = n > 1 ? (2 * i) / (n - 1) - 1 : 0;

					const rotateDeg = t * (MAX_FAN_DEG / 2);
					// parabola: edges drop down, centre stays up
					const translateY = t * t * ARC_DROP_PX;
					const translateX = (i - (n - 1) / 2) * CARD_OVERLAP_PX;

					const isPlayable = playableIds ? playableIds.has(inst.instanceId) : true;
					const isSelected = inst.instanceId === selectedId;

					let definition: CardDefinition;
					try {
						definition = getCardDefinition(inst.definitionId);
					} catch {
						// Guard: unknown card id — skip rendering
						return null;
					}

					return (
						<motion.div
							key={inst.instanceId}
							className="absolute bottom-0"
							style={{ zIndex: isSelected ? 20 : i }}
							initial={{ y: 60, opacity: 0, scale: 0.8 }}
							animate={{
								x: translateX,
								y: translateY,
								rotate: rotateDeg,
								opacity: 1,
								scale: 1,
							}}
							exit={{ y: 60, opacity: 0, scale: 0.8 }}
							transition={{ type: "spring", stiffness: 300, damping: 26 }}
							whileHover={{
								y: translateY - 40,
								zIndex: 30,
								transition: { type: "spring", stiffness: 400, damping: 22 },
							}}
						>
							<CardFrame
								definition={definition}
								upgradeLevel={inst.upgradeLevel}
								isPlayable={isPlayable}
								isSelected={isSelected}
								onClick={onCardClick ? () => onCardClick(inst.instanceId) : undefined}
								size="sm"
							/>
						</motion.div>
					);
				})}
			</AnimatePresence>
		</section>
	);
}
