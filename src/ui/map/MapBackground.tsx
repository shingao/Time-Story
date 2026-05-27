// ---------------------------------------------------------------------------
// MapBackground — dark overlay + subtle grid pattern behind the map content
// ---------------------------------------------------------------------------

export function MapBackground() {
	return (
		<>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{ background: "rgba(0,0,0,0.45)", zIndex: 0 }}
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-[0.03]"
				style={{
					backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
					backgroundSize: "32px 32px",
					zIndex: 0,
				}}
			/>
		</>
	);
}
