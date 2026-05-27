import { ATMOSPHERES } from "@data/atmospheres.ts";
import { useUIStore } from "@state/useUIStore.ts";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

// ---------------------------------------------------------------------------
// Dev panel — toggle with Shift+D to preview atmospheres in any scene
// ---------------------------------------------------------------------------

export function AtmosphereDevPanel() {
	const [isOpen, setIsOpen] = useState(false);

	const { currentAtmosphereId, setAtmosphere, atmosphereEffectsEnabled, setAtmosphereEffects } =
		useUIStore(
			useShallow((s) => ({
				currentAtmosphereId: s.currentAtmosphereId,
				setAtmosphere: s.setAtmosphere,
				atmosphereEffectsEnabled: s.atmosphereEffectsEnabled,
				setAtmosphereEffects: s.setAtmosphereEffects,
			})),
		);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.shiftKey && e.key === "D") {
				e.preventDefault();
				setIsOpen((v) => !v);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					role="dialog"
					aria-label="Atmosphere dev panel"
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: 20 }}
					transition={{ type: "spring", stiffness: 320, damping: 28 }}
					style={{
						position: "fixed",
						top: "1rem",
						right: "1rem",
						zIndex: 9999,
						background: "rgba(0,0,0,0.88)",
						border: "1px solid rgba(255,255,255,0.15)",
						borderRadius: "12px",
						padding: "12px 14px",
						minWidth: "220px",
						fontFamily: "monospace",
						fontSize: "11px",
						color: "rgba(255,255,255,0.85)",
						backdropFilter: "blur(8px)",
					}}
				>
					<p
						style={{
							margin: "0 0 8px",
							fontWeight: "bold",
							fontSize: "10px",
							letterSpacing: "0.1em",
							color: "rgba(255,255,255,0.4)",
							textTransform: "uppercase",
						}}
					>
						Atmosphere — Shift+D
					</p>

					<div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
						{Object.values(ATMOSPHERES).map((atm) => {
							const isActive = currentAtmosphereId === atm.id;
							return (
								<button
									key={atm.id}
									type="button"
									onClick={() => setAtmosphere(atm.id)}
									style={{
										textAlign: "left",
										background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
										border: "none",
										borderRadius: "6px",
										padding: "4px 8px",
										color: isActive ? "white" : "rgba(255,255,255,0.55)",
										cursor: "pointer",
										fontSize: "11px",
										fontFamily: "monospace",
									}}
								>
									{isActive ? "▶ " : "  "}
									{atm.displayName}
								</button>
							);
						})}
					</div>

					<div
						style={{
							marginTop: "8px",
							paddingTop: "8px",
							borderTop: "1px solid rgba(255,255,255,0.1)",
						}}
					>
						<label
							style={{
								display: "flex",
								alignItems: "center",
								gap: "6px",
								cursor: "pointer",
								color: "rgba(255,255,255,0.65)",
							}}
						>
							<input
								type="checkbox"
								checked={atmosphereEffectsEnabled}
								onChange={(e) => setAtmosphereEffects(e.currentTarget.checked)}
							/>
							Atmosphere effects
						</label>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
