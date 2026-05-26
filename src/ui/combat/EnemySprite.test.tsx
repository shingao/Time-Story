import { asEnemyId, asEntityId, createEnemy } from "@core/combat/entity.ts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnemySprite } from "./EnemySprite.tsx";

function makePidgey() {
	return createEnemy({
		id: asEntityId("enemy-0"),
		name: "Pidgey",
		types: ["normal", "flying"],
		maxHp: 12,
		definitionId: asEnemyId("pidgey"),
	});
}

describe("EnemySprite", () => {
	it("renders the enemy name", () => {
		const enemy = makePidgey();
		render(<EnemySprite enemy={enemy} isTargeted={false} onClick={() => {}} />);
		expect(screen.getByText("Pidgey")).toBeTruthy();
	});

	it("renders type badges", () => {
		const enemy = makePidgey();
		render(<EnemySprite enemy={enemy} isTargeted={false} onClick={() => {}} />);
		expect(screen.getByText("normal")).toBeTruthy();
		expect(screen.getByText("flying")).toBeTruthy();
	});

	it("renders HP bar with correct values", () => {
		const enemy = makePidgey();
		render(<EnemySprite enemy={enemy} isTargeted={false} onClick={() => {}} />);
		expect(screen.getByRole("progressbar")).toBeTruthy();
	});

	it("shows HP text", () => {
		const enemy = makePidgey();
		render(<EnemySprite enemy={enemy} isTargeted={false} onClick={() => {}} />);
		expect(screen.getByText("12 / 12")).toBeTruthy();
	});

	it("renders nothing when HP is 0", () => {
		const enemy = makePidgey();
		enemy.hp = 0;
		const { container } = render(
			<EnemySprite enemy={enemy} isTargeted={false} onClick={() => {}} />,
		);
		expect(container.textContent).toBe("");
	});

	it("fires onClick when sprite tile is clicked", async () => {
		const onClick = vi.fn();
		const enemy = makePidgey();
		render(<EnemySprite enemy={enemy} isTargeted={false} onClick={onClick} />);
		const tile = screen.getByRole("button", { name: /Target Pidgey/i });
		tile.click();
		expect(onClick).toHaveBeenCalledOnce();
	});
});
