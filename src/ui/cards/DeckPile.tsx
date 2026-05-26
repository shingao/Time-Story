import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Pile type config
// ---------------------------------------------------------------------------

type PileType = "draw" | "discard" | "exhaust";

const PILE_CONFIG: Record<
	PileType,
	{ label: string; icon: string; color: string; emptyColor: string }
> = {
	draw: {
		label: "Draw",
		icon: "▣",
		color: "var(--color-dungeon-accent)",
		emptyColor: "rgba(255,255,255,0.15)",
	},
	discard: {
		label: "Discard",
		icon: "↺",
		color: "#b45309",
		emptyColor: "rgba(255,255,255,0.15)",
	},
	exhaust: {
		label: "Exhaust",
		icon: "✦",
		color: "#6b21a8",
		emptyColor: "rgba(255,255,255,0.15)",
	},
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DeckPileProps {
	readonly type: PileType;
	readonly count: number;
	readonly onClick?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeckPile({ type, count, onClick }: DeckPileProps) {
	const cfg = PILE_CONFIG[type];
	const isEmpty = count === 0;
	const bg = isEmpty ? cfg.emptyColor : cfg.color;

	return (
		<motion.button
			type="button"
			onClick={onClick}
			disabled={!onClick}
			className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 font-semibold text-white disabled:cursor-default"
			style={{
				background: bg,
				minWidth: 48,
				opacity: isEmpty ? 0.5 : 1,
				fontFamily: "var(--font-pmd)",
				boxShadow: isEmpty ? "none" : "0 2px 8px rgba(0,0,0,0.4)",
			}}
			whileHover={onClick && !isEmpty ? { scale: 1.08, y: -2 } : undefined}
			whileTap={onClick && !isEmpty ? { scale: 0.95 } : undefined}
			transition={{ type: "spring", stiffness: 350, damping: 22 }}
			aria-label={`${cfg.label} pile: ${count} card${count !== 1 ? "s" : ""}`}
		>
			<span className="text-lg leading-none" aria-hidden>
				{cfg.icon}
			</span>
			<span className="text-[11px] tabular-nums leading-none">{count}</span>
			<span className="text-[9px] uppercase leading-none tracking-wide opacity-80">
				{cfg.label}
			</span>
		</motion.button>
	);
}
