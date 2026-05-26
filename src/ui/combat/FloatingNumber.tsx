import { useFloatingNumbersStore } from "@state/useFloatingNumbersStore.ts";
import { motion } from "framer-motion";
import { useEffect } from "react";

interface FloatingNumberProps {
	readonly id: string;
	readonly amount: number;
}

export function FloatingNumber({ id, amount }: FloatingNumberProps) {
	const remove = useFloatingNumbersStore((s) => s.remove);

	useEffect(() => {
		const timer = setTimeout(() => remove(id), 900);
		return () => clearTimeout(timer);
	}, [id, remove]);

	return (
		<motion.div
			className="pointer-events-none absolute left-1/2 top-1/4 z-30 -translate-x-1/2 select-none font-bold text-white text-xl drop-shadow-lg"
			style={{ fontFamily: "var(--font-pmd)" }}
			initial={{ opacity: 1, y: 0, scale: 1.4 }}
			animate={{ opacity: 0, y: -56, scale: 1 }}
			transition={{ duration: 0.9, ease: "easeOut" }}
			aria-hidden
		>
			{amount > 0 ? `-${amount}` : `${amount}`}
		</motion.div>
	);
}
