import { motion } from "framer-motion";

interface HpBarProps {
	readonly current: number;
	readonly max: number;
	readonly className?: string;
}

export function HpBar({ current, max, className = "" }: HpBarProps) {
	const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
	const color = pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444";

	return (
		<div
			className={`relative h-2 overflow-hidden rounded-full bg-black/40 ${className}`}
			role="progressbar"
			aria-valuenow={current}
			aria-valuemin={0}
			aria-valuemax={max}
			aria-label={`HP: ${current} / ${max}`}
		>
			<motion.div
				className="absolute inset-y-0 left-0 rounded-full"
				style={{ backgroundColor: color }}
				animate={{ width: `${pct * 100}%` }}
				transition={{ duration: 0.3, ease: "easeOut" }}
			/>
		</div>
	);
}
