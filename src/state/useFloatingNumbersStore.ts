import { create } from "zustand";

export interface FloatingNumberEntry {
	readonly id: string;
	readonly entityId: string;
	readonly amount: number;
}

interface FloatingNumbersState {
	readonly entries: readonly FloatingNumberEntry[];
}

interface FloatingNumbersActions {
	spawn(entityId: string, amount: number): void;
	remove(id: string): void;
	clear(): void;
}

export type FloatingNumbersStore = FloatingNumbersState & FloatingNumbersActions;

let _counter = 0;

export const useFloatingNumbersStore = create<FloatingNumbersStore>()((set) => ({
	entries: [],
	spawn: (entityId, amount) => {
		const id = `fn-${_counter++}`;
		set((s) => ({ entries: [...s.entries, { id, entityId, amount }] }));
	},
	remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
	clear: () => set({ entries: [] }),
}));
