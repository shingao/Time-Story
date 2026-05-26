import { resetSpawnCounter } from "@core/enemies/enemy-registry.ts";
import { useCombatStore } from "@state/useCombatStore.ts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DevMenu } from "./DevMenu.tsx";

beforeEach(() => {
	useCombatStore.getState().reset();
	resetSpawnCounter();
});

describe("DevMenu", () => {
	it("renders all four encounter buttons", () => {
		render(<DevMenu onStartCombat={() => {}} />);
		expect(screen.getByText(/Charmander vs Pidgey/i)).toBeTruthy();
		expect(screen.getByText(/Charmander vs Caterpie/i)).toBeTruthy();
		expect(screen.getByText(/Treecko vs Mankey/i)).toBeTruthy();
		expect(screen.getByText(/Elite Beedrill/i)).toBeTruthy();
	});

	it("renders a link to the card gallery", () => {
		render(<DevMenu onStartCombat={() => {}} />);
		const link = screen.getByText(/Card Gallery/i);
		expect(link).toBeTruthy();
	});

	it("calls onStartCombat and initialises combat when an encounter is clicked", async () => {
		const onStartCombat = vi.fn();
		render(<DevMenu onStartCombat={onStartCombat} />);

		const btn = screen.getByText(/Charmander vs Pidgey/i);
		await userEvent.click(btn);

		expect(onStartCombat).toHaveBeenCalledOnce();
		// Combat store should now have a state
		expect(useCombatStore.getState().combatState).not.toBeNull();
	});
});
