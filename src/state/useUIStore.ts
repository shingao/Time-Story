import { create } from "zustand";

export type AnimationSpeed = "normal" | "fast" | "instant";

interface UIState {
	readonly selectedCardId: string | null;
	readonly animationSpeed: AnimationSpeed;
}

interface UIActions {
	selectCard(id: string): void;
	clearSelection(): void;
	setAnimationSpeed(speed: AnimationSpeed): void;
}

export type UIStore = UIState & UIActions;

const INITIAL: UIState = {
	selectedCardId: null,
	animationSpeed: "normal",
};

export const useUIStore = create<UIStore>()((set) => ({
	...INITIAL,
	selectCard: (id) => set({ selectedCardId: id }),
	clearSelection: () => set({ selectedCardId: null }),
	setAnimationSpeed: (speed) => set({ animationSpeed: speed }),
}));
