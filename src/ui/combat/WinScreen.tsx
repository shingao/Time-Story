import { motion } from "framer-motion";

interface WinScreenProps {
	readonly onContinue: () => void;
}

export function WinScreen({ onContinue }: WinScreenProps) {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="absolute inset-0 z-50 flex flex-col items-center justify-center"
			style={{ background: "rgba(0,0,0,0.75)", fontFamily: "var(--font-pmd)" }}
			aria-modal="true"
			role="dialog"
			aria-label="Victory!"
		>
			<motion.div
				initial={{ scale: 0.7, y: 20 }}
				animate={{ scale: 1, y: 0 }}
				transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.1 }}
				className="flex flex-col items-center gap-6 rounded-2xl px-10 py-8 text-center"
				style={{ background: "rgba(30,70,30,0.95)", border: "2px solid #4ade80" }}
			>
				<span className="text-5xl" aria-hidden>
					🏆
				</span>
				<h2
					className="font-bold text-4xl text-green-300"
					style={{ textShadow: "0 0 20px rgba(74,222,128,0.6)" }}
				>
					Victory!
				</h2>
				<p className="text-white/70 text-sm">You defeated all enemies!</p>

				{/* Reward placeholder */}
				<div
					className="rounded-lg px-4 py-3 text-sm text-white/80"
					style={{
						background: "rgba(255,255,255,0.08)",
						border: "1px solid rgba(255,255,255,0.15)",
					}}
				>
					🎁 Reward placeholder
					{/* TODO(phase-4.4): card reward picker */}
				</div>

				<motion.button
					type="button"
					onClick={onContinue}
					className="rounded-xl px-8 py-3 font-bold text-white text-lg"
					style={{ background: "rgba(74,222,128,0.8)" }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.97 }}
				>
					Continue
				</motion.button>
			</motion.div>
		</motion.div>
	);
}
