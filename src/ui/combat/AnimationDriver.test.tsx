import type { CombatState } from "@core/combat/effects/effect-handler.ts";
import { asCardId, asEnemyId, asEntityId, createEnemy, createPlayer } from "@core/combat/entity.ts";
import { resetSpawnCounter } from "@core/enemies/enemy-registry.ts";
import { useCombatStore } from "@state/useCombatStore.ts";
import { useUIStore } from "@state/useUIStore.ts";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AnimationDriver } from "./AnimationDriver.tsx";

function makeState(): CombatState {
	return {
		player: createPlayer({
			id: asEntityId("player"),
			name: "Charmander",
			types: ["fire"],
			maxHp: 44,
		}),
		enemies: [
			createEnemy({
				id: asEntityId("enemy-0"),
				name: "Pidgey",
				types: ["normal", "flying"],
				maxHp: 12,
				definitionId: asEnemyId("pidgey"),
			}),
		],
		hand: [{ instanceId: "scratch-0", definitionId: asCardId("scratch"), upgradeLevel: 0 }],
		drawPile: [
			{ instanceId: "scratch-1", definitionId: asCardId("scratch"), upgradeLevel: 0 },
			{ instanceId: "scratch-2", definitionId: asCardId("scratch"), upgradeLevel: 0 },
			{ instanceId: "growl-0", definitionId: asCardId("growl"), upgradeLevel: 0 },
			{ instanceId: "growl-1", definitionId: asCardId("growl"), upgradeLevel: 0 },
		],
		discardPile: [],
		exhaustPile: [],
	};
}

beforeEach(() => {
	useCombatStore.getState().reset();
	resetSpawnCounter();
});

describe("AnimationDriver", () => {
	it("renders without crashing", () => {
		const { unmount } = render(<AnimationDriver />);
		unmount();
	});

	it("drains the animation queue in instant mode", async () => {
		useUIStore.getState().setAnimationSpeed("instant");
		useCombatStore.getState().initCombat(makeState(), 42);

		expect(useCombatStore.getState().animationQueue.length).toBeGreaterThan(0);

		await act(async () => {
			render(<AnimationDriver />);
			// Give instant mode a tick to run
			await new Promise((r) => setTimeout(r, 10));
		});

		expect(useCombatStore.getState().animationQueue).toHaveLength(0);
		useUIStore.getState().setAnimationSpeed("normal");
	});

	it("consumes frames over time in fast mode using fake timers", async () => {
		vi.useFakeTimers();
		useUIStore.getState().setAnimationSpeed("fast");
		useCombatStore.getState().initCombat(makeState(), 42);

		const initialLen = useCombatStore.getState().animationQueue.length;
		expect(initialLen).toBeGreaterThan(0);

		render(<AnimationDriver />);

		// Advance past the 60ms fast-mode delay
		await act(async () => {
			vi.advanceTimersByTime(120);
		});

		const afterLen = useCombatStore.getState().animationQueue.length;
		expect(afterLen).toBeLessThan(initialLen);

		vi.useRealTimers();
		useUIStore.getState().setAnimationSpeed("normal");
	});
});
