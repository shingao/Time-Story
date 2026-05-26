import type { Intent } from "@core/combat/entity.ts";
import { motion } from "framer-motion";

interface IntentBadgeProps {
	readonly intent: Intent;
}

function label(intent: Intent): string {
	switch (intent.kind) {
		case "attack":
			return intent.hits > 1 ? `⚔️ ${intent.damage}×${intent.hits}` : `⚔️ ${intent.damage}`;
		case "defend":
			return `🛡️ ${intent.block}`;
		case "buff":
			return `💪 +${intent.stacks}`;
		case "debuff":
			return `☠️ ${String(intent.statusId)} +${intent.stacks}`;
		case "unknown":
			return "❓";
	}
}

function badgeColor(intent: Intent): string {
	switch (intent.kind) {
		case "attack":
			return "rgba(180,30,30,0.9)";
		case "defend":
			return "rgba(30,90,200,0.9)";
		case "buff":
			return "rgba(180,110,10,0.9)";
		case "debuff":
			return "rgba(120,20,160,0.9)";
		case "unknown":
			return "rgba(60,60,60,0.9)";
	}
}

export function IntentBadge({ intent }: IntentBadgeProps) {
	return (
		<motion.div
			key={intent.kind}
			initial={{ opacity: 0, y: -6, scale: 0.85 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ type: "spring", stiffness: 400, damping: 24 }}
			className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 font-bold text-white text-xs shadow-lg"
			style={{ background: badgeColor(intent), fontFamily: "var(--font-pmd)" }}
			aria-label={`Enemy intent: ${label(intent)}`}
		>
			{label(intent)}
		</motion.div>
	);
}
