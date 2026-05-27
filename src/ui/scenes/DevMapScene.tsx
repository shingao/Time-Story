import { printMapAscii } from "@core/dungeon/devUtils.ts";
import { generateDungeonMap } from "@core/dungeon/mapGenerator.ts";
import type { NodeId } from "@core/dungeon/types.ts";
import { useUIStore } from "@state/useUIStore.ts";
import { CombatBackground } from "@ui/combat/CombatBackground.tsx";
import { MapViewport } from "@ui/map/MapViewport.tsx";
import { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Hash param parsing
// ---------------------------------------------------------------------------

function parseSeedFromHash(hash: string): { seed: number; act: number } {
	const query = hash.includes("?") ? (hash.split("?")[1] ?? "") : "";
	const params = new URLSearchParams(query);
	const seedStr = params.get("seed");
	const actStr = params.get("act");
	const seed =
		seedStr !== null ? (parseInt(seedStr, 10) & 0xffffffff) >>> 0 : (Date.now() ^ 0xdeadbeef) >>> 0;
	const act = actStr !== null ? Math.max(1, parseInt(actStr, 10)) : 1;
	return { seed, act };
}

function buildHashUrl(seed: number, act: number): string {
	const actPart = act !== 1 ? `&act=${act}` : "";
	return `#/dev/map?seed=${seed}${actPart}`;
}

// ---------------------------------------------------------------------------
// DevMapScene
// ---------------------------------------------------------------------------

export function DevMapScene() {
	const { seed: initialSeed, act } = parseSeedFromHash(window.location.hash);
	const [seed, setSeed] = useState(initialSeed);
	const [inputValue, setInputValue] = useState(String(initialSeed));
	const [viewBossSignal, setViewBossSignal] = useState(0);
	const [copied, setCopied] = useState(false);

	// Set dim cave atmosphere on mount
	useEffect(() => {
		useUIStore.getState().setAtmosphere("dim_cave");
	}, []);

	const mapData = useMemo(() => {
		try {
			const dm = generateDungeonMap(seed, act);
			return { map: dm, ascii: printMapAscii(dm) };
		} catch {
			return null;
		}
	}, [seed, act]);

	const updateSeed = useCallback(
		(newSeed: number) => {
			const s = newSeed >>> 0;
			setSeed(s);
			setInputValue(String(s));
			const newHash = buildHashUrl(s, act);
			history.replaceState(
				null,
				"",
				`${window.location.pathname}${window.location.search}${newHash}`,
			);
		},
		[act],
	);

	const handleInputBlur = useCallback(() => {
		const parsed = parseInt(inputValue, 10);
		if (!Number.isNaN(parsed)) {
			updateSeed(parsed);
		} else {
			setInputValue(String(seed));
		}
	}, [inputValue, seed, updateSeed]);

	const handleInputKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") handleInputBlur();
		},
		[handleInputBlur],
	);

	const handleRandom = useCallback(() => {
		updateSeed((Math.random() * 0xffffffff) >>> 0);
	}, [updateSeed]);

	const handleCopyLink = useCallback(() => {
		navigator.clipboard
			.writeText(`${window.location.origin}${window.location.pathname}${buildHashUrl(seed, act)}`)
			.then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			})
			.catch(() => {});
	}, [seed, act]);

	// Empty sets — view-only, no navigation
	const emptySet = useMemo(() => new Set<NodeId>(), []);

	return (
		<div
			className="relative flex h-screen flex-col overflow-hidden"
			style={{ fontFamily: "var(--font-pmd)" }}
		>
			<CombatBackground />

			{/* Toolbar */}
			<div
				className="relative z-10 flex flex-wrap items-center gap-2 px-4 py-2"
				style={{
					background: "rgba(0,0,0,0.7)",
					backdropFilter: "blur(8px)",
					borderBottom: "1px solid rgba(255,255,255,0.08)",
					flexShrink: 0,
				}}
			>
				<a
					href="#/"
					className="rounded px-2 py-1 text-[11px] text-white/50 hover:text-white/80 transition-colors"
					style={{ background: "rgba(255,255,255,0.06)" }}
				>
					← Back
				</a>

				<span className="text-white/20">|</span>
				<span className="text-white/50 text-[11px]">Seed:</span>

				<input
					type="number"
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onBlur={handleInputBlur}
					onKeyDown={handleInputKeyDown}
					className="rounded px-2 py-1 text-[11px] text-white"
					style={{
						background: "rgba(255,255,255,0.1)",
						border: "1px solid rgba(255,255,255,0.2)",
						width: 110,
						outline: "none",
					}}
				/>

				<button
					type="button"
					onClick={handleRandom}
					className="rounded px-2 py-1 text-[11px] text-white/70 hover:text-white transition-colors"
					style={{
						background: "rgba(255,255,255,0.08)",
						border: "1px solid rgba(255,255,255,0.1)",
					}}
				>
					🎲 Random
				</button>

				<button
					type="button"
					onClick={handleCopyLink}
					className="rounded px-2 py-1 text-[11px] transition-colors"
					style={{
						background: copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
						border: "1px solid rgba(255,255,255,0.1)",
						color: copied ? "#86efac" : "rgba(255,255,255,0.7)",
					}}
				>
					{copied ? "✓ Copied!" : "📋 Copy link"}
				</button>

				<button
					type="button"
					onClick={() => setViewBossSignal((s) => s + 1)}
					className="rounded px-2 py-1 text-[11px] text-white/60 hover:text-white/90 transition-colors"
					style={{
						background: "rgba(220,38,38,0.15)",
						border: "1px solid rgba(220,38,38,0.25)",
					}}
				>
					☠ View Boss
				</button>

				{mapData && (
					<span className="ml-auto text-[10px] text-white/30">
						{mapData.map.nodes.size} nodes · Act {act}
					</span>
				)}
			</div>

			{/* Map */}
			{mapData ? (
				<div className="relative flex-1 overflow-hidden">
					<MapViewport
						nodes={mapData.map.nodes}
						numColumns={mapData.map.numColumns}
						numFloors={mapData.map.numFloors}
						availableNodeIds={emptySet}
						visitedNodeIds={emptySet}
						currentNodeId={null}
						onNodeClick={() => {}}
						viewBossSignal={viewBossSignal}
					/>

					{/* ASCII dump — collapsible bottom-right */}
					<div
						className="pointer-events-none absolute bottom-4 right-4 z-20"
						style={{ maxWidth: 340 }}
					>
						<details
							className="pointer-events-auto"
							style={{
								background: "rgba(0,0,0,0.85)",
								borderRadius: 8,
								border: "1px solid rgba(255,255,255,0.1)",
								padding: "6px 10px",
							}}
						>
							<summary
								className="cursor-pointer text-[10px] text-white/40 hover:text-white/60"
								style={{ userSelect: "none" }}
							>
								ASCII map
							</summary>
							<pre
								className="mt-2 overflow-auto text-[9px] text-white/60"
								style={{ maxHeight: 240, fontFamily: "monospace" }}
							>
								{mapData.ascii}
							</pre>
						</details>
					</div>
				</div>
			) : (
				<div className="flex flex-1 items-center justify-center text-white/50 text-sm">
					Invalid seed
				</div>
			)}
		</div>
	);
}
