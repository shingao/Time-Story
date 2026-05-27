import type { Atmosphere } from "@data/atmospheres.ts";
import { ATMOSPHERES } from "@data/atmospheres.ts";
import { useUIStore } from "@state/useUIStore.ts";
import type { MotionValue } from "framer-motion";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { memo, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ParticleLayer } from "./ParticleLayer.tsx";

// ---------------------------------------------------------------------------
// Inner slide — one per atmosphere, manages its own image-error state
// ---------------------------------------------------------------------------

interface SlideProps {
	readonly atmosphere: Atmosphere;
	readonly mouseX: MotionValue<number>;
	readonly mouseY: MotionValue<number>;
	readonly showEffects: boolean;
}

const AtmosphereSlide = memo(function AtmosphereSlide({
	atmosphere,
	mouseX,
	mouseY,
	showEffects,
}: SlideProps) {
	const [imgError, setImgError] = useState(false);

	const parallaxPx = showEffects ? (atmosphere.parallaxIntensity ?? 0) * 20 : 0;
	// Functional form so the closure stays fresh when showEffects toggles
	const bgX = useTransform(mouseX, (v) => (v - 0.5) * parallaxPx * 2);
	const bgY = useTransform(mouseY, (v) => (v - 0.5) * parallaxPx * 2);

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.8, ease: "easeInOut" }}
			style={{ position: "absolute", inset: 0 }}
		>
			{/* Background image — falls back to gradient on load error */}
			{imgError ? (
				<div
					role="img"
					aria-label={`Placeholder: ${atmosphere.displayName}`}
					style={{
						position: "absolute",
						inset: 0,
						background: atmosphere.placeholderGradient,
					}}
				>
					<span
						style={{
							position: "absolute",
							bottom: "8px",
							left: "50%",
							transform: "translateX(-50%)",
							color: "rgba(255,255,255,0.25)",
							fontSize: "11px",
							fontFamily: "monospace",
							whiteSpace: "nowrap",
							pointerEvents: "none",
						}}
					>
						[Placeholder: {atmosphere.displayName}]
					</span>
				</div>
			) : (
				<motion.img
					src={atmosphere.imagePath}
					alt=""
					aria-hidden
					loading="eager"
					onError={() => setImgError(true)}
					style={{
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						objectFit: "cover",
						// 1.1 zoom gives parallax room to shift without exposing edges
						scale: 1.1,
						x: bgX,
						y: bgY,
					}}
				/>
			)}

			{/* Optional color tint */}
			{atmosphere.tint && (
				<div
					aria-hidden
					style={{
						position: "absolute",
						inset: 0,
						background: atmosphere.tint,
						opacity: atmosphere.tintOpacity ?? 0.1,
						pointerEvents: "none",
					}}
				/>
			)}

			{/* Vignette — darkens edges for depth */}
			{(atmosphere.vignetteStrength ?? 0) > 0 && (
				<div
					aria-hidden
					style={{
						position: "absolute",
						inset: 0,
						background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${atmosphere.vignetteStrength ?? 0.4}) 100%)`,
						pointerEvents: "none",
					}}
				/>
			)}

			{/* Particles — only when effects are enabled */}
			{showEffects && atmosphere.particles && <ParticleLayer config={atmosphere.particles} />}
		</motion.div>
	);
});

// ---------------------------------------------------------------------------
// Public component — mount once near the root of the app
// ---------------------------------------------------------------------------

export function AtmosphereLayer() {
	const { currentAtmosphereId, atmosphereEffectsEnabled } = useUIStore(
		useShallow((s) => ({
			currentAtmosphereId: s.currentAtmosphereId,
			atmosphereEffectsEnabled: s.atmosphereEffectsEnabled,
		})),
	);

	const atmosphere = ATMOSPHERES[currentAtmosphereId];

	// Parallax tracking — shared across crossfades so the image doesn't jump
	const mouseX = useMotionValue(0.5);
	const mouseY = useMotionValue(0.5);

	const isTouch = useMemo(
		() => typeof window !== "undefined" && window.matchMedia("(hover: none)").matches,
		[],
	);

	const showEffects = atmosphereEffectsEnabled && !isTouch;

	useEffect(() => {
		if (!showEffects) return;
		const handleMove = (e: MouseEvent) => {
			mouseX.set(e.clientX / window.innerWidth);
			mouseY.set(e.clientY / window.innerHeight);
		};
		window.addEventListener("mousemove", handleMove);
		return () => window.removeEventListener("mousemove", handleMove);
	}, [showEffects, mouseX, mouseY]);

	return (
		<div
			aria-hidden
			style={{
				position: "fixed",
				inset: 0,
				zIndex: -1,
				overflow: "hidden",
				pointerEvents: "none",
			}}
		>
			<AnimatePresence>
				<AtmosphereSlide
					key={currentAtmosphereId}
					atmosphere={atmosphere}
					mouseX={mouseX}
					mouseY={mouseY}
					showEffects={showEffects}
				/>
			</AnimatePresence>
		</div>
	);
}
