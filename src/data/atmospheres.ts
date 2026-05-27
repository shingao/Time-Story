// ---------------------------------------------------------------------------
// Atmosphere system — all backgrounds and ambient configs for every scene.
//
// Images live in src/assets/backgrounds/. Add PNGs there to replace placeholders.
// NOTE: for production builds, images should be imported as Vite modules rather
// than referenced by URL string. These paths work in Vite dev mode and degrade
// gracefully to the placeholderGradient fallback when the file is missing.
// ---------------------------------------------------------------------------

export type AtmosphereId =
	| "guild_interior"
	| "mystifying_forest"
	| "dim_cave"
	| "crystal_cave"
	| "distortion_realm"
	| "summit_peak"
	| "dark_future"
	| "aftermath";

export type ParticleKind = "leaves" | "embers" | "dust" | "snow" | "distortion";

export interface ParticleConfig {
	readonly kind: ParticleKind;
	/** 0..1 multiplied against the base particle count for this kind. */
	readonly density: number;
}

export interface Atmosphere {
	readonly id: AtmosphereId;
	readonly imagePath: string;
	readonly displayName: string;
	/** Optional CSS color string for a tint overlay. */
	readonly tint?: string;
	/** Opacity of the tint layer (0..1). Default 0.1. */
	readonly tintOpacity?: number;
	/** Strength of edge darkening vignette (0..1). 0 = no vignette. */
	readonly vignetteStrength?: number;
	/** Max parallax shift as a fraction of 20px (0..1). 0 = no parallax. */
	readonly parallaxIntensity?: number;
	/** Optional particle layer rendered above the background. */
	readonly particles?: ParticleConfig;
	/** BGM track id — wired up in Phase 6.2. */
	readonly bgmId?: string;
	/** CSS gradient shown when the image file is missing. */
	readonly placeholderGradient: string;
}

export const ATMOSPHERES: Record<AtmosphereId, Atmosphere> = {
	guild_interior: {
		id: "guild_interior",
		imagePath: "/src/assets/backgrounds/guild-interior.png",
		displayName: "Wigglytuff's Guild",
		vignetteStrength: 0.25,
		parallaxIntensity: 0.03,
		placeholderGradient: "linear-gradient(135deg, #8B5E3C 0%, #6B4226 50%, #4A2E1A 100%)",
	},
	mystifying_forest: {
		id: "mystifying_forest",
		imagePath: "/src/assets/backgrounds/mystifying-forest.png",
		displayName: "Mystifying Forest",
		vignetteStrength: 0.4,
		parallaxIntensity: 0.05,
		particles: { kind: "leaves", density: 0.3 },
		placeholderGradient: "linear-gradient(135deg, #1a3d1f 0%, #2d5a27 45%, #1a3d1f 100%)",
	},
	dim_cave: {
		id: "dim_cave",
		imagePath: "/src/assets/backgrounds/dim-cave.png",
		displayName: "Dim Cave",
		tint: "#000022",
		tintOpacity: 0.2,
		vignetteStrength: 0.55,
		parallaxIntensity: 0.02,
		particles: { kind: "dust", density: 0.4 },
		placeholderGradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
	},
	crystal_cave: {
		id: "crystal_cave",
		imagePath: "/src/assets/backgrounds/crystal-cave.png",
		displayName: "Crystal Cave",
		tint: "#00BFFF",
		tintOpacity: 0.1,
		vignetteStrength: 0.4,
		parallaxIntensity: 0.04,
		particles: { kind: "snow", density: 0.2 },
		placeholderGradient: "linear-gradient(135deg, #0d2137 0%, #1a4a6b 50%, #2d7aa8 100%)",
	},
	distortion_realm: {
		id: "distortion_realm",
		imagePath: "/src/assets/backgrounds/distortion-realm.png",
		displayName: "Distortion Realm",
		tint: "#8B00FF",
		tintOpacity: 0.15,
		vignetteStrength: 0.6,
		particles: { kind: "distortion", density: 0.5 },
		placeholderGradient: "linear-gradient(135deg, #1a0033 0%, #4a0080 50%, #1a0033 100%)",
	},
	summit_peak: {
		id: "summit_peak",
		imagePath: "/src/assets/backgrounds/summit-peak.png",
		displayName: "Summit Peak",
		vignetteStrength: 0.3,
		parallaxIntensity: 0.06,
		particles: { kind: "snow", density: 0.4 },
		placeholderGradient:
			"linear-gradient(180deg, #87CEEB 0%, #B0C4DE 40%, #E8E8E8 80%, #F0F0F0 100%)",
	},
	dark_future: {
		id: "dark_future",
		imagePath: "/src/assets/backgrounds/dark-future.png",
		displayName: "Dark Future",
		tint: "#FF4500",
		tintOpacity: 0.12,
		vignetteStrength: 0.65,
		particles: { kind: "embers", density: 0.6 },
		placeholderGradient: "linear-gradient(135deg, #1a0000 0%, #3d0000 50%, #1a0000 100%)",
	},
	aftermath: {
		id: "aftermath",
		imagePath: "/src/assets/backgrounds/aftermath.png",
		displayName: "Aftermath",
		tint: "#666666",
		tintOpacity: 0.25,
		vignetteStrength: 0.7,
		particles: { kind: "dust", density: 0.5 },
		placeholderGradient: "linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 50%, #0a0a0a 100%)",
	},
};
