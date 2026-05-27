import type { AtmosphereId } from "@data/atmospheres.ts";
import { ATMOSPHERES } from "@data/atmospheres.ts";
import { create } from "zustand";

export type AnimationSpeed = "normal" | "fast" | "instant";

interface UIState {
	readonly selectedCardId: string | null;
	readonly animationSpeed: AnimationSpeed;
	readonly currentAtmosphereId: AtmosphereId;
	/** When false: particles and parallax are disabled; background image still shown. */
	readonly atmosphereEffectsEnabled: boolean;
}

interface UIActions {
	selectCard(id: string): void;
	clearSelection(): void;
	setAnimationSpeed(speed: AnimationSpeed): void;
	setAtmosphere(id: AtmosphereId): void;
	setAtmosphereEffects(enabled: boolean): void;
}

export type UIStore = UIState & UIActions;

const INITIAL: UIState = {
	selectedCardId: null,
	animationSpeed: "normal",
	currentAtmosphereId: "guild_interior",
	atmosphereEffectsEnabled: true,
};

export const useUIStore = create<UIStore>()((set) => ({
	...INITIAL,
	selectCard: (id) => set({ selectedCardId: id }),
	clearSelection: () => set({ selectedCardId: null }),
	setAnimationSpeed: (speed) => set({ animationSpeed: speed }),
	setAtmosphere: (id) => {
		set({ currentAtmosphereId: id });
		// Kick off browser image preload so the asset is cached when rendered
		if (typeof window !== "undefined") {
			const img = new window.Image();
			img.src = ATMOSPHERES[id].imagePath;
		}
	},
	setAtmosphereEffects: (enabled) => set({ atmosphereEffectsEnabled: enabled }),
}));
