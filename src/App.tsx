import { useCombatStore } from "@state/useCombatStore.ts";
import { AtmosphereDevPanel } from "@ui/atmosphere/AtmosphereDevPanel.tsx";
import { AtmosphereLayer } from "@ui/atmosphere/AtmosphereLayer.tsx";
import { CardGallery } from "@ui/scenes/CardGallery.tsx";
import { CombatScene } from "@ui/scenes/CombatScene.tsx";
import { DevMenu } from "@ui/scenes/DevMenu.tsx";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Simple hash-based router — no library needed for three screens.
// TODO(phase-6.3): When the Guild hub ships at /, move dev encounters to #/dev.
// ---------------------------------------------------------------------------

type Route = "devMenu" | "combat" | "cardGallery";

function resolveRoute(hash: string, hasCombat: boolean): Route {
	if (hash === "#/dev/cards") return "cardGallery";
	if (hash === "#/combat" && hasCombat) return "combat";
	return "devMenu";
}

function useHashRoute(): string {
	const [hash, setHash] = useState(() => window.location.hash);
	useEffect(() => {
		const handler = () => setHash(window.location.hash);
		window.addEventListener("hashchange", handler);
		return () => window.removeEventListener("hashchange", handler);
	}, []);
	return hash;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
	const hash = useHashRoute();
	const hasCombat = useCombatStore((s) => s.combatState !== null);
	const route = resolveRoute(hash, hasCombat);

	function goTo(newHash: string) {
		window.location.hash = newHash;
	}

	return (
		<div style={{ minHeight: "100svh" }}>
			<AtmosphereLayer />

			{route === "cardGallery" && <CardGallery />}
			{route === "combat" && <CombatScene onReturn={() => goTo("#/")} />}
			{route === "devMenu" && <DevMenu onStartCombat={() => goTo("#/combat")} />}

			<AtmosphereDevPanel />
		</div>
	);
}
