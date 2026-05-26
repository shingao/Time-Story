import { createStarterDeck } from "@core/cards/card-registry.ts";
import { Rng } from "@core/rng/rng.ts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Hand } from "./Hand.tsx";

const deck = createStarterDeck("charmander", new Rng(1));
const hand = deck.slice(0, 5);

describe("Hand — rendering", () => {
	it("renders without crashing with empty hand", () => {
		const { container } = render(<Hand cards={[]} />);
		expect(container.firstChild).toBeInTheDocument();
	});

	it("renders correct number of card frames", () => {
		render(<Hand cards={hand} />);
		// Each card has an energy cost label
		const costLabels = screen.getAllByLabelText(/Energy cost:/);
		expect(costLabels).toHaveLength(5);
	});

	it("shows accessible hand label", () => {
		render(<Hand cards={hand} />);
		expect(screen.getByLabelText("Hand: 5 cards")).toBeInTheDocument();
	});

	it("shows singular label for 1-card hand", () => {
		render(<Hand cards={hand.slice(0, 1)} />);
		expect(screen.getByLabelText("Hand: 1 card")).toBeInTheDocument();
	});

	it("shows zero-card hand label", () => {
		render(<Hand cards={[]} />);
		expect(screen.getByLabelText("Hand: 0 cards")).toBeInTheDocument();
	});
});

describe("Hand — interactivity", () => {
	it("calls onCardClick with the correct instanceId", async () => {
		const user = userEvent.setup();
		const handler = vi.fn();
		render(<Hand cards={hand} onCardClick={handler} />);
		const firstCard = screen.getAllByLabelText(/Energy cost:/)[0];
		if (!firstCard) throw new Error("No cards rendered");
		await user.click(firstCard);
		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith(hand[0]?.instanceId);
	});

	it("does not call onCardClick for unplayable cards", async () => {
		const user = userEvent.setup();
		const handler = vi.fn();
		const id1 = hand[1]?.instanceId ?? "";
		const id2 = hand[2]?.instanceId ?? "";
		const playableIds = new Set([id1, id2]);
		render(<Hand cards={hand} playableIds={playableIds} onCardClick={handler} />);
		const firstCost = screen.getAllByLabelText(/Energy cost:/)[0];
		if (!firstCost) throw new Error("No cards rendered");
		await user.click(firstCost);
		expect(handler).not.toHaveBeenCalled();
	});
});

describe("Hand — treecko deck", () => {
	it("renders treecko hand without crashing", () => {
		const treeckoDeck = createStarterDeck("treecko", new Rng(2));
		render(<Hand cards={treeckoDeck.slice(0, 5)} />);
		expect(screen.getByLabelText("Hand: 5 cards")).toBeInTheDocument();
	});
});
