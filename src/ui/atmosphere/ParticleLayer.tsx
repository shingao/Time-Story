import type { ParticleConfig, ParticleKind } from "@data/atmospheres.ts";
import { memo, useMemo } from "react";

// ---------------------------------------------------------------------------
// CSS keyframe definitions — injected once into <head>
// ---------------------------------------------------------------------------

const KEYFRAMES = `
@keyframes pmd-leaf {
  0%   { opacity: 0; transform: translate(0, 0) rotate(0deg); }
  5%   { opacity: 0.75; }
  95%  { opacity: 0.75; }
  100% { opacity: 0; transform: translate(15vw, 110vh) rotate(720deg); }
}
@keyframes pmd-ember {
  0%   { opacity: 0; transform: translate(0, 0) scale(1); }
  15%  { opacity: 1; }
  85%  { opacity: 0.5; }
  100% { opacity: 0; transform: translate(5vw, -110vh) scale(0.2); }
}
@keyframes pmd-dust {
  0%   { opacity: 0; transform: translate(0, 0); }
  25%  { opacity: 0.45; }
  75%  { opacity: 0.45; }
  100% { opacity: 0; transform: translate(8vw, 5vh); }
}
@keyframes pmd-snow {
  0%   { opacity: 0; transform: translate(0, 0); }
  8%   { opacity: 0.85; }
  92%  { opacity: 0.85; }
  100% { opacity: 0; transform: translate(4vw, 110vh); }
}
@keyframes pmd-distortion {
  0%   { opacity: 0; transform: translate(0, 0) skewX(0deg) scaleX(1); }
  20%  { opacity: 0.9; transform: translate(1vw, -0.5vh) skewX(8deg) scaleX(1.3); }
  40%  { opacity: 0.2; transform: translate(-1vw, 0.3vh) skewX(-12deg) scaleX(0.6); }
  60%  { opacity: 0.8; transform: translate(0.5vw, -0.8vh) skewX(5deg) scaleX(1.2); }
  80%  { opacity: 0.15; transform: translate(-0.3vw, 0.6vh) skewX(-4deg) scaleX(0.85); }
  100% { opacity: 0; transform: translate(0, 0) skewX(0deg) scaleX(1); }
}
`;

function ensureKeyframes(): void {
	if (typeof document === "undefined") return;
	if (document.getElementById("pmd-particle-keyframes")) return;
	const style = document.createElement("style");
	style.id = "pmd-particle-keyframes";
	style.textContent = KEYFRAMES;
	document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Per-kind config
// ---------------------------------------------------------------------------

const BASE_COUNTS: Record<ParticleKind, number> = {
	leaves: 15,
	embers: 20,
	dust: 25,
	snow: 30,
	distortion: 15,
};

const BASE_DURATIONS: Record<ParticleKind, number> = {
	leaves: 12,
	embers: 8,
	dust: 15,
	snow: 10,
	distortion: 4,
};

interface ParticleStyle {
	readonly size: readonly [number, number]; // [min, max] px
	readonly colors: readonly string[];
	readonly borderRadius: string;
}

const PARTICLE_STYLES: Record<ParticleKind, ParticleStyle> = {
	leaves: {
		size: [6, 10],
		colors: ["#4a8c3a", "#5aaa48", "#3d7a30", "#7ac050", "#2d6020"],
		borderRadius: "40% 60% 60% 40% / 50% 40% 60% 50%",
	},
	embers: {
		size: [3, 5],
		colors: ["#ff6b35", "#ff8c42", "#ffa500", "#ff4500", "#ffcc00"],
		borderRadius: "50%",
	},
	dust: {
		size: [2, 4],
		colors: ["rgba(200,200,200,0.6)", "rgba(180,180,200,0.5)", "rgba(160,160,180,0.4)"],
		borderRadius: "50%",
	},
	snow: {
		size: [4, 8],
		colors: ["rgba(255,255,255,0.9)", "rgba(240,248,255,0.8)", "rgba(220,240,255,0.7)"],
		borderRadius: "50%",
	},
	distortion: {
		size: [8, 30],
		colors: [
			"rgba(140,0,255,0.7)",
			"rgba(0,200,255,0.6)",
			"rgba(200,0,200,0.5)",
			"rgba(0,255,200,0.4)",
		],
		borderRadius: "0",
	},
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ParticleData {
	readonly key: number;
	readonly left: number;
	readonly top: number;
	readonly duration: number;
	readonly delay: number;
	readonly size: number;
	readonly color: string;
}

interface ParticleLayerProps {
	readonly config: ParticleConfig;
}

export const ParticleLayer = memo(function ParticleLayer({ config }: ParticleLayerProps) {
	ensureKeyframes();

	const particles = useMemo<readonly ParticleData[]>(() => {
		const count = Math.max(1, Math.round(BASE_COUNTS[config.kind] * config.density));
		const styles = PARTICLE_STYLES[config.kind];
		const baseDuration = BASE_DURATIONS[config.kind];
		const [minSize, maxSize] = styles.size;

		return Array.from({ length: count }, (_, i) => {
			const colorIndex = Math.floor(Math.random() * styles.colors.length);
			return {
				key: i,
				left: Math.random() * 100,
				// Some start off-screen so they don't all appear at once
				top: Math.random() * 120 - 10,
				duration: baseDuration * (0.7 + Math.random() * 0.6),
				// Negative delay puts particles mid-animation on mount
				delay: -(Math.random() * baseDuration),
				size: minSize + Math.random() * (maxSize - minSize),
				color: styles.colors[colorIndex] ?? styles.colors[0] ?? "#ffffff",
			};
		});
	}, [config.kind, config.density]);

	const kindStyles = PARTICLE_STYLES[config.kind];

	return (
		<div
			aria-hidden
			style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}
		>
			{particles.map((p) => (
				<div
					key={p.key}
					style={{
						position: "absolute",
						left: `${p.left}%`,
						top: `${p.top}%`,
						width: `${p.size}px`,
						height: `${p.size}px`,
						borderRadius: kindStyles.borderRadius,
						backgroundColor: p.color,
						animation: `pmd-${config.kind} ${p.duration}s ${p.delay}s ease-in-out infinite`,
						pointerEvents: "none",
					}}
				/>
			))}
		</div>
	);
});
