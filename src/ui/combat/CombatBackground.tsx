/**
 * Combat scene ambient overlay — thin dark wash + grid detail on top of
 * the AtmosphereLayer background. Does NOT provide its own opaque background.
 */
export function CombatBackground() {
	return (
		<>
			{/* Semi-transparent dark wash for UI readability over the atmosphere image */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{ background: "rgba(0,0,0,0.35)", zIndex: 0 }}
			/>

			{/* Subtle pixel-grid detail layer */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-[0.04]"
				style={{
					backgroundImage: `
						linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
						linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)
					`,
					backgroundSize: "40px 40px",
					zIndex: 0,
				}}
			/>
		</>
	);
}
