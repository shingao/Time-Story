import type { RoomType } from "@core/dungeon/types.ts";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StubRoomModalProps {
	readonly roomType: RoomType;
	readonly onContinue: () => void; // returnToMap or endRun('victory') for boss
}

// ---------------------------------------------------------------------------
// Stub content
// ---------------------------------------------------------------------------

const STUB_CONTENT: Partial<
	Record<RoomType, { title: string; phase: string; btnLabel: string; icon: string }>
> = {
	event: {
		title: "Unknown Event",
		phase: "Phase 5.2",
		btnLabel: "Skip and continue",
		icon: "❓",
	},
	shop: {
		title: "Kecleon's Shop",
		phase: "Phase 5.3",
		btnLabel: "Skip and continue",
		icon: "🏪",
	},
	campfire: {
		title: "Kangaskhan Statue",
		phase: "Phase 4.3",
		btnLabel: "Rest and continue",
		icon: "🏛",
	},
	treasure: {
		title: "Treasure Room",
		phase: "Phase 4.4",
		btnLabel: "Collect and continue",
		icon: "💎",
	},
	boss: {
		title: "Act 1 Boss — TBD",
		phase: "Phase 5.x",
		btnLabel: "Claim victory (stub)",
		icon: "☠",
	},
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StubRoomModal({ roomType, onContinue }: StubRoomModalProps) {
	const content = STUB_CONTENT[roomType] ?? {
		title: "Room",
		phase: "TBD",
		btnLabel: "Continue",
		icon: "❓",
	};

	return (
		<motion.div
			key="stub-modal-overlay"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
			className="absolute inset-0 z-50 flex items-center justify-center"
			style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
		>
			<motion.div
				initial={{ scale: 0.85, opacity: 0, y: 24 }}
				animate={{ scale: 1, opacity: 1, y: 0 }}
				exit={{ scale: 0.85, opacity: 0, y: 24 }}
				transition={{ duration: 0.25, ease: "easeOut" }}
				className="flex flex-col items-center gap-5 rounded-2xl p-8 text-center"
				style={{
					background: "rgba(20,20,30,0.96)",
					border: "1px solid rgba(255,255,255,0.12)",
					minWidth: 300,
					maxWidth: 400,
				}}
			>
				{/* Icon */}
				<div
					className="flex items-center justify-center rounded-full"
					style={{
						width: 72,
						height: 72,
						fontSize: 36,
						background: "rgba(255,255,255,0.06)",
						border: "1px solid rgba(255,255,255,0.1)",
					}}
				>
					{content.icon}
				</div>

				{/* Title */}
				<div>
					<h2 className="font-bold text-xl text-white">{content.title}</h2>
					<p className="mt-1 text-[11px] text-white/40">
						Full implementation coming in {content.phase}
					</p>
				</div>

				{/* Stub notice */}
				<p
					className="rounded-lg px-4 py-2 text-[12px] text-white/50"
					style={{
						background: "rgba(255,255,255,0.04)",
						border: "1px dashed rgba(255,255,255,0.1)",
					}}
				>
					This room is a stub. Click below to continue your run.
				</p>

				{/* Continue button */}
				<motion.button
					type="button"
					onClick={onContinue}
					className="w-full rounded-xl px-6 py-3 font-semibold text-sm text-white transition-colors"
					style={{
						background: roomType === "boss" ? "rgba(220,38,38,0.8)" : "rgba(99,102,241,0.8)",
						border: "1px solid rgba(255,255,255,0.15)",
					}}
					whileHover={{ scale: 1.03 }}
					whileTap={{ scale: 0.97 }}
				>
					{content.btnLabel}
				</motion.button>
			</motion.div>
		</motion.div>
	);
}
