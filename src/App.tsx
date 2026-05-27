import { useCombatStore } from "@state/useCombatStore.ts";
import { useRunStore } from "@state/useRunStore.ts";
import { AtmosphereDevPanel } from "@ui/atmosphere/AtmosphereDevPanel.tsx";
import { AtmosphereLayer } from "@ui/atmosphere/AtmosphereLayer.tsx";
import { CardGallery } from "@ui/scenes/CardGallery.tsx";
import { CombatScene } from "@ui/scenes/CombatScene.tsx";
import { DevMapScene } from "@ui/scenes/DevMapScene.tsx";
import { DevMenu } from "@ui/scenes/DevMenu.tsx";
import { MapScene } from "@ui/scenes/MapScene.tsx";
import { RunCombatAdapter } from "@ui/scenes/RunCombatAdapter.tsx";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Hash-based router
// TODO(phase-6.3): When the Guild hub ships at /, move dev encounters to #/dev.
// ---------------------------------------------------------------------------

type Route = "devMenu" | "combat" | "cardGallery" | "run" | "devMap";

function resolveRoute(hash: string, hasCombat: boolean, hasRun: boolean): Route {
	if (hash.startsWith("#/dev/map")) return "devMap";
	if (hash === "#/dev/cards") return "cardGallery";
	if (hash === "#/combat" && hasCombat && !hasRun) return "combat";
	if (hasRun) return "run";
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
// RunContainer — delegates to combat or map based on run status
// ---------------------------------------------------------------------------

function RunContainer({ onEndRun }: { readonly onEndRun: () => void }) {
	const runStatus = useRunStore((s) => s.status);
	if (runStatus === "in_combat") {
		return <RunCombatAdapter onEndRun={onEndRun} />;
	}
	return <MapScene onEndRun={onEndRun} />;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
	const hash = useHashRoute();
	const hasCombat = useCombatStore((s) => s.combatState !== null);
	const hasRun = useRunStore((s) => s.serializedMap !== null);
	const route = resolveRoute(hash, hasCombat, hasRun);

	function goTo(newHash: string) {
		window.location.hash = newHash;
	}

	function handleEndRun() {
		useRunStore.getState().clearRun();
		goTo("#/");
	}

	return (
		<div style={{ minHeight: "100svh" }}>
			<AtmosphereLayer />

			{route === "devMap" && <DevMapScene />}
			{route === "cardGallery" && <CardGallery />}
			{route === "run" && <RunContainer onEndRun={handleEndRun} />}
			{route === "combat" && <CombatScene onReturn={() => goTo("#/")} />}
			{route === "devMenu" && (
				<DevMenu onStartCombat={() => goTo("#/combat")} onStartRun={() => goTo("#/run")} />
			)}

			<AtmosphereDevPanel />
		</div>
	);
}
