/** PMD-themed dungeon background — CSS gradient, no assets needed. */
export function CombatBackground() {
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-0"
			style={{
				background: `
          radial-gradient(ellipse at 50% 0%, #0f3460 0%, transparent 60%),
          radial-gradient(ellipse at 80% 80%, #2d0033 0%, transparent 50%),
          linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%)
        `,
				zIndex: 0,
			}}
		>
			{/* Subtle grid overlay */}
			<div
				className="absolute inset-0 opacity-5"
				style={{
					backgroundImage: `
            linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
          `,
					backgroundSize: "40px 40px",
				}}
			/>
		</div>
	);
}
