import { getCardDefinition } from "@core/cards/card-registry.ts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardFrame } from "./CardFrame.tsx";

const scratch = getCardDefinition("scratch");
const ember = getCardDefinition("ember");
const fireBomb = getCardDefinition("fire-blast");

describe("CardFrame — renders card content", () => {
	it("shows card name", () => {
		render(<CardFrame definition={scratch} />);
		expect(screen.getByText("Scratch")).toBeInTheDocument();
	});

	it("shows energy cost", () => {
		render(<CardFrame definition={scratch} />);
		expect(screen.getByLabelText("Energy cost: 1")).toBeInTheDocument();
	});

	it("shows zero-cost card", () => {
		const dragRage = getCardDefinition("dragon-rage");
		render(<CardFrame definition={dragRage} />);
		expect(screen.getByLabelText("Energy cost: 0")).toBeInTheDocument();
	});

	it("shows description", () => {
		render(<CardFrame definition={scratch} />);
		expect(screen.getByText("Deal 6 damage.")).toBeInTheDocument();
	});

	it("shows primary type badge", () => {
		render(<CardFrame definition={ember} />);
		expect(screen.getByLabelText("Type: fire")).toBeInTheDocument();
	});

	it("shows rarity label", () => {
		render(<CardFrame definition={scratch} />);
		expect(screen.getByLabelText("Rarity: starter")).toBeInTheDocument();
	});

	it("shows rare rarity for fire-blast", () => {
		render(<CardFrame definition={fireBomb} />);
		expect(screen.getByLabelText("Rarity: rare")).toBeInTheDocument();
	});
});

describe("CardFrame — upgrade level", () => {
	it("shows + suffix when upgraded", () => {
		render(<CardFrame definition={scratch} upgradeLevel={1} />);
		// Name stays "Scratch" (resolveCard merges upgradeMap.name = "Scratch+")
		expect(screen.getByText(/Scratch\+/)).toBeInTheDocument();
	});

	it("shows upgraded description", () => {
		render(<CardFrame definition={scratch} upgradeLevel={1} />);
		expect(screen.getByText("Deal 9 damage.")).toBeInTheDocument();
	});

	it("shows no + at level 0", () => {
		render(<CardFrame definition={scratch} upgradeLevel={0} />);
		// No element with "+" in the name row
		expect(screen.queryByText("+")).not.toBeInTheDocument();
	});
});

describe("CardFrame — playability", () => {
	it("has pointer cursor when playable and onClick given", () => {
		const { container } = render(<CardFrame definition={scratch} isPlayable onClick={vi.fn()} />);
		const card = container.firstChild as HTMLElement;
		expect(card.style.cursor).toBe("pointer");
	});

	it("has default cursor when not playable", () => {
		const { container } = render(
			<CardFrame definition={scratch} isPlayable={false} onClick={vi.fn()} />,
		);
		const card = container.firstChild as HTMLElement;
		expect(card.style.cursor).toBe("default");
	});

	it("does not fire onClick when not playable", () => {
		const handler = vi.fn();
		render(<CardFrame definition={scratch} isPlayable={false} onClick={handler} />);
		screen.getByText("Scratch").click();
		expect(handler).not.toHaveBeenCalled();
	});
});

describe("CardFrame — sizes", () => {
	it("renders sm size with correct width", () => {
		const { container } = render(<CardFrame definition={scratch} size="sm" />);
		const card = container.firstChild as HTMLElement;
		expect(card.style.width).toBe("130px");
	});

	it("renders md size with correct width", () => {
		const { container } = render(<CardFrame definition={scratch} size="md" />);
		const card = container.firstChild as HTMLElement;
		expect(card.style.width).toBe("160px");
	});

	it("renders lg size with correct width", () => {
		const { container } = render(<CardFrame definition={scratch} size="lg" />);
		const card = container.firstChild as HTMLElement;
		expect(card.style.width).toBe("200px");
	});
});

describe("CardFrame — testid forwarding", () => {
	it("forwards data-testid", () => {
		render(<CardFrame definition={scratch} data-testid="my-card" />);
		expect(screen.getByTestId("my-card")).toBeInTheDocument();
	});
});
