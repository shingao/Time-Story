import type { PlayerSnapshot } from "@core/run/types.ts";
import { HEADER_HEIGHT } from "./mapLayout.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MapHeaderProps {
	readonly playerSnapshot: PlayerSnapshot;
	readonly currentAct: number;
	readonly currentFloor: number | null; // null = at entrance (no current node)
	readonly numFloors: number;
	readonly onViewBoss: () => void;
	readonly onViewDeck: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MapHeader({
	playerSnapshot,
	currentAct,
	currentFloor,
	numFloors,
	onViewBoss,
	onViewDeck,
}: MapHeaderProps) {
	const { currentHp, maxHp, gold } = playerSnapshot;
	const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;

	const hpColor = hpPct > 0.6 ? "#22c55e" : hpPct > 0.3 ? "#eab308" : "#ef4444";

	const floorLabel =
		currentFloor !== null
			? `Act ${currentAct} · Floor ${currentFloor + 1} / ${numFloors - 1}`
			: `Act ${currentAct} · Entrance`;

	return (
		<div
			className="relative z-10 flex items-center gap-4 px-4"
			style={{
				height: HEADER_HEIGHT,
				background: "rgba(0,0,0,0.6)",
				backdropFilter: "blur(8px)",
				borderBottom: "1px solid rgba(255,255,255,0.08)",
				flexShrink: 0,
			}}
		>
			{/* HP bar */}
			<div className="flex min-w-[120px] flex-col gap-1">
				<div className="flex items-center justify-between">
					<span className="text-[10px] text-white/50 uppercase tracking-wider">HP</span>
					<span className="text-[11px] text-white/80 font-semibold">
						{currentHp} / {maxHp}
					</span>
				</div>
				<div
					className="h-2 w-full rounded-full overflow-hidden"
					style={{ background: "rgba(255,255,255,0.1)" }}
				>
					<div
						className="h-full rounded-full transition-all duration-300"
						style={{ width: `${hpPct * 100}%`, background: hpColor }}
					/>
				</div>
			</div>

			{/* Separator */}
			<div className="h-8 w-px" style={{ background: "rgba(255,255,255,0.1)" }} />

			{/* Gold */}
			<div className="flex items-center gap-1.5">
				<span className="text-base">💰</span>
				<span className="text-[12px] text-white/70 font-semibold">{gold}</span>
			</div>

			{/* Separator */}
			<div className="h-8 w-px" style={{ background: "rgba(255,255,255,0.1)" }} />

			{/* Floor indicator */}
			<div
				className="rounded px-2 py-1 text-[11px] text-white/60"
				style={{ background: "rgba(255,255,255,0.06)" }}
			>
				{floorLabel}
			</div>

			{/* Deck button */}
			<button
				type="button"
				onClick={onViewDeck}
				className="rounded px-2 py-1 text-[11px] text-white/50 hover:text-white/80 transition-colors"
				style={{
					background: "rgba(255,255,255,0.06)",
					border: "1px solid rgba(255,255,255,0.1)",
				}}
				title="View Deck (Phase 4.4)"
			>
				🃏 Deck ({playerSnapshot.deckCardIds.length})
			</button>

			{/* Relics placeholder */}
			<div
				className="flex items-center gap-1 rounded px-2 py-1"
				style={{
					border: "1px dashed rgba(255,255,255,0.12)",
				}}
			>
				<span className="text-[10px] text-white/30">✦ Relics</span>
			</div>

			{/* Spacer */}
			<div className="flex-1" />

			{/* View Boss button */}
			<button
				type="button"
				onClick={onViewBoss}
				className="rounded px-2 py-1 text-[11px] text-white/60 hover:text-white/90 transition-colors"
				style={{
					background: "rgba(220,38,38,0.15)",
					border: "1px solid rgba(220,38,38,0.3)",
				}}
			>
				☠ View Boss
			</button>

			{/* Settings stub */}
			<button
				type="button"
				className="rounded p-1.5 text-white/40 hover:text-white/70 transition-colors"
				style={{ background: "rgba(255,255,255,0.06)" }}
				title="Settings (stub)"
				aria-label="Settings"
			>
				⚙️
			</button>
		</div>
	);
}
