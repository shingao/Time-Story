import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeckPile } from "./DeckPile.tsx";

describe("DeckPile — draw pile", () => {
	it("renders with correct aria-label", () => {
		render(<DeckPile type="draw" count={10} />);
		expect(screen.getByLabelText("Draw pile: 10 cards")).toBeInTheDocument();
	});

	it("shows count", () => {
		render(<DeckPile type="draw" count={7} />);
		expect(screen.getByText("7")).toBeInTheDocument();
	});

	it("shows singular label for 1 card", () => {
		render(<DeckPile type="draw" count={1} />);
		expect(screen.getByLabelText("Draw pile: 1 card")).toBeInTheDocument();
	});

	it("shows zero count", () => {
		render(<DeckPile type="draw" count={0} />);
		expect(screen.getByLabelText("Draw pile: 0 cards")).toBeInTheDocument();
	});
});

describe("DeckPile — discard pile", () => {
	it("renders with correct aria-label", () => {
		render(<DeckPile type="discard" count={3} />);
		expect(screen.getByLabelText("Discard pile: 3 cards")).toBeInTheDocument();
	});

	it("shows label text", () => {
		render(<DeckPile type="discard" count={3} />);
		expect(screen.getByText("Discard")).toBeInTheDocument();
	});
});

describe("DeckPile — exhaust pile", () => {
	it("renders with correct aria-label", () => {
		render(<DeckPile type="exhaust" count={2} />);
		expect(screen.getByLabelText("Exhaust pile: 2 cards")).toBeInTheDocument();
	});

	it("shows label text", () => {
		render(<DeckPile type="exhaust" count={2} />);
		expect(screen.getByText("Exhaust")).toBeInTheDocument();
	});
});

describe("DeckPile — onClick", () => {
	it("fires onClick when clicked and count > 0", async () => {
		const user = userEvent.setup();
		const handler = vi.fn();
		render(<DeckPile type="draw" count={5} onClick={handler} />);
		await user.click(screen.getByRole("button"));
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("button is disabled when no onClick prop", () => {
		render(<DeckPile type="draw" count={5} />);
		expect(screen.getByRole("button")).toBeDisabled();
	});
});
