import type { StarterName } from "@core/cards/card-registry.ts";
import type { EnemyId } from "@core/combat/entity.ts";
import { asEnemyId } from "@core/combat/entity.ts";
import { resetSpawnCounter } from "@core/enemies/enemy-registry.ts";
import { useCombatStore } from "@state/useCombatStore.ts";
import { motion } from "framer-motion";
import { createDevCombat } from "./devCombatFactory.ts";

// ---------------------------------------------------------------------------
// Encounter definitions
// ---------------------------------------------------------------------------

const ENCOUNTERS: ReadonlyArray<{
	label: string;
	starter: StarterName;
	enemyId: EnemyId;
	description: string;
}> = [
	{
		label: "Charmander vs Pidgey",
		starter: "charmander",
		enemyId: asEnemyId("pidgey"),
		description: "Normal · A straightforward first fight.",
	},
	{
		label: "Charmander vs Caterpie",
		starter: "charmander",
		enemyId: asEnemyId("caterpie"),
		description: "Bug · A wriggly warm-up.",
	},
	{
		label: "Treecko vs Mankey",
		starter: "treecko",
		enemyId: asEnemyId("mankey"),
		description: "Fighting · Gets aggressive at low HP.",
	},
	{
		label: "Charmander vs Elite Beedrill",
		starter: "charmander",
		enemyId: asEnemyId("beedrill-elite"),
		description: "Bug/Poison · Elite encounter — multi-hit finisher.",
	},
];

// ---------------------------------------------------------------------------
// DevMenu
// ---------------------------------------------------------------------------

interface DevMenuProps {
	readonly onStartCombat: () => void;
}

export function DevMenu({ onStartCombat }: DevMenuProps) {
	const initCombat = useCombatStore((s) => s.initCombat);
	const seed = (Date.now() ^ 0xdeadbeef) >>> 0;

	function startEncounter(starter: StarterName, enemyId: EnemyId) {
		resetSpawnCounter();
		const state = createDevCombat(starter, enemyId);
		initCombat(state, seed);
		onStartCombat();
	}

	return (
		<div
			className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12"
			style={{ fontFamily: "var(--font-pmd)" }}
		>
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: -20 }}
				animate={{ opacity: 1, y: 0 }}
				className="text-center"
			>
				<h1
					className="font-bold text-4xl text-guild-accent"
					style={{
						color: "var(--color-guild-accent)",
						textShadow: "0 2px 12px rgba(212,160,68,0.4)",
					}}
				>
					Pokémon Mystery Spire
				</h1>
				<p className="mt-1 text-sm opacity-50">Dev Menu — Phase 3.3</p>
				{/* TODO(phase-6.3): move to /dev when Guild hub ships at / */}
			</motion.div>

			{/* Encounter list */}
			<motion.section
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.08 }}
				className="w-full max-w-md"
				aria-label="Combat encounters"
			>
				<h2 className="mb-3 text-center text-sm uppercase tracking-widest text-white/40">
					Start Combat
				</h2>
				<div className="flex flex-col gap-3">
					{ENCOUNTERS.map((enc) => (
						<motion.button
							key={enc.label}
							type="button"
							onClick={() => startEncounter(enc.starter, enc.enemyId)}
							className="group flex flex-col items-start rounded-xl px-5 py-4 text-left transition-colors"
							style={{
								background: "rgba(255,255,255,0.06)",
								border: "1px solid rgba(255,255,255,0.10)",
							}}
							whileHover={{
								scale: 1.02,
								backgroundColor: "rgba(255,255,255,0.10)",
							}}
							whileTap={{ scale: 0.98 }}
						>
							<span className="font-bold text-white text-sm">{enc.label}</span>
							<span className="mt-0.5 text-[11px] text-white/50">{enc.description}</span>
						</motion.button>
					))}
				</div>
			</motion.section>

			{/* Card gallery link */}
			<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}>
				<a
					href="#/dev/cards"
					className="text-xs text-white/40 underline decoration-dotted hover:text-white/70"
				>
					View Card Gallery →
				</a>
			</motion.div>
		</div>
	);
}
