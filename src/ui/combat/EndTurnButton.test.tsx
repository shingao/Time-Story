import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EndTurnButton } from "./EndTurnButton.tsx";

describe("EndTurnButton", () => {
	it("shows 'End Turn' during player turn", () => {
		render(<EndTurnButton phase="PLAYER_TURN" hasUnusedEnergy={false} onEndTurn={() => {}} />);
		expect(screen.getByText("End Turn")).toBeTruthy();
	});

	it("shows 'Enemy Turn' during enemy turn", () => {
		render(<EndTurnButton phase="ENEMY_TURN" hasUnusedEnergy={false} onEndTurn={() => {}} />);
		expect(screen.getByText("Enemy Turn…")).toBeTruthy();
	});

	it("is disabled during enemy turn", () => {
		render(<EndTurnButton phase="ENEMY_TURN" hasUnusedEnergy={false} onEndTurn={() => {}} />);
		const btn = screen.getByRole("button");
		expect(btn).toBeDisabled();
	});

	it("calls onEndTurn when clicked during player turn", async () => {
		const fn = vi.fn();
		render(<EndTurnButton phase="PLAYER_TURN" hasUnusedEnergy={false} onEndTurn={fn} />);
		await userEvent.click(screen.getByRole("button"));
		expect(fn).toHaveBeenCalledOnce();
	});

	it("fires onEndTurn on Spacebar during player turn", async () => {
		const fn = vi.fn();
		render(<EndTurnButton phase="PLAYER_TURN" hasUnusedEnergy={false} onEndTurn={fn} />);
		await userEvent.keyboard(" ");
		expect(fn).toHaveBeenCalledOnce();
	});
});
