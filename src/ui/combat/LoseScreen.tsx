import { motion } from "framer-motion";

interface LoseScreenProps {
	readonly onReturn: () => void;
}

export function LoseScreen({ onReturn }: LoseScreenProps) {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="absolute inset-0 z-50 flex flex-col items-center justify-center"
			style={{ background: "rgba(0,0,0,0.8)", fontFamily: "var(--font-pmd)" }}
			aria-modal="true"
			role="dialog"
			aria-label="You fainted!"
		>
			<motion.div
				initial={{ scale: 0.7, y: 20 }}
				animate={{ scale: 1, y: 0 }}
				transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.1 }}
				className="flex flex-col items-center gap-6 rounded-2xl px-10 py-8 text-center"
				style={{ background: "rgba(60,10,10,0.95)", border: "2px solid #ef4444" }}
			>
				<span className="text-5xl" aria-hidden>
					💫
				</span>
				<h2
					className="font-bold text-4xl text-red-400"
					style={{ textShadow: "0 0 20px rgba(239,68,68,0.6)" }}
				>
					You fainted...
				</h2>
				<p className="text-white/70 text-sm">Hang in there — every explorer stumbles. Try again!</p>

				<motion.button
					type="button"
					onClick={onReturn}
					className="rounded-xl px-8 py-3 font-bold text-white text-lg"
					style={{ background: "rgba(239,68,68,0.7)" }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.97 }}
				>
					Return to Guild
				</motion.button>
			</motion.div>
		</motion.div>
	);
}
