import type { CombatState } from "@core/combat/effects/effect-handler.ts";
import { CombatContext } from "@core/combat/effects/effect-handler.ts";
import { asCardId, asEntityId, createEnemy, createPlayer } from "@core/combat/entity.ts";
import { Rng } from "@core/rng/rng.ts";
import { describe, expect, it } from "vitest";
import type { CardInstance } from "./card-definition.ts";
import {
	discardCard,
	discardHand,
	drawCards,
	exhaustCard,
	MAX_HAND_SIZE,
	reshuffleDiscard,
} from "./deck-manager.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(id: string): CardInstance {
	return { instanceId: id, definitionId: asCardId(id), upgradeLevel: 0 };
}

function cards(...ids: string[]): CardInstance[] {
	return ids.map(makeCard);
}

function makeState(
	opts: {
		drawPile?: CardInstance[];
		discardPile?: CardInstance[];
		hand?: CardInstance[];
		exhaustPile?: CardInstance[];
	} = {},
): CombatState {
	return {
		player: createPlayer({
			id: asEntityId("player"),
			name: "Charmander",
			types: ["fire"],
			maxHp: 44,
		}),
		enemies: [createEnemy({ id: asEntityId("e1"), name: "Pidgey", types: ["normal"], maxHp: 20 })],
		hand: opts.hand ?? [],
		drawPile: opts.drawPile ?? [],
		discardPile: opts.discardPile ?? [],
		exhaustPile: opts.exhaustPile ?? [],
	};
}

function makeCtx(opts: Parameters<typeof makeState>[0] = {}): CombatContext {
	return new CombatContext(makeState(opts));
}

const rng = new Rng(42);

// ---------------------------------------------------------------------------
// MAX_HAND_SIZE constant
// ---------------------------------------------------------------------------

describe("MAX_HAND_SIZE", () => {
	it("is 10", () => {
		expect(MAX_HAND_SIZE).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// drawCards
// ---------------------------------------------------------------------------

describe("drawCards()", () => {
	it("draws the requested number of cards from drawPile", () => {
		const ctx = makeCtx({ drawPile: cards("a", "b", "c", "d", "e") });
		drawCards(3, ctx, rng);
		expect(ctx.state.hand).toHaveLength(3);
		expect(ctx.state.drawPile).toHaveLength(2);
	});

	it("drawn cards are removed from drawPile", () => {
		const ctx = makeCtx({ drawPile: cards("a", "b", "c") });
		drawCards(2, ctx, rng);
		expect(ctx.state.drawPile).toHaveLength(1);
	});

	it("emits CARD_DRAWN for each drawn card", () => {
		const ctx = makeCtx({ drawPile: cards("a", "b", "c") });
		drawCards(3, ctx, rng);
		const draws = ctx.log.filter((l) => l.event.type === "CARD_DRAWN");
		expect(draws).toHaveLength(3);
	});

	it("CARD_DRAWN event carries correct instanceId", () => {
		const ctx = makeCtx({ drawPile: [makeCard("specific")] });
		drawCards(1, ctx, rng);
		const ev = ctx.log.find((l) => l.event.type === "CARD_DRAWN")?.event;
		expect(ev?.type).toBe("CARD_DRAWN");
		if (ev?.type === "CARD_DRAWN") expect(ev.cardInstanceId).toBe("specific");
	});

	it("draws from the top of the pile (last element)", () => {
		// drawPile = [bottom, ..., top]; pop() draws from the top
		const ctx = makeCtx({ drawPile: [makeCard("bottom"), makeCard("top")] });
		drawCards(1, ctx, rng);
		expect(ctx.state.hand[0]?.instanceId).toBe("top");
		expect(ctx.state.drawPile[0]?.instanceId).toBe("bottom");
	});

	it("stops when hand reaches MAX_HAND_SIZE", () => {
		const existingHand = Array.from({ length: MAX_HAND_SIZE - 1 }, (_, i) => makeCard(`h${i}`));
		const ctx = makeCtx({
			hand: existingHand,
			drawPile: cards("new1", "new2", "new3"),
		});
		drawCards(3, ctx, rng);
		expect(ctx.state.hand).toHaveLength(MAX_HAND_SIZE); // only 1 more card drawn
		expect(ctx.state.drawPile).toHaveLength(2); // 2 left behind
	});

	it("does not draw when hand is already at MAX_HAND_SIZE", () => {
		const fullHand = Array.from({ length: MAX_HAND_SIZE }, (_, i) => makeCard(`h${i}`));
		const ctx = makeCtx({ hand: fullHand, drawPile: cards("extra") });
		drawCards(1, ctx, rng);
		expect(ctx.state.hand).toHaveLength(MAX_HAND_SIZE);
		expect(ctx.state.drawPile).toHaveLength(1); // untouched
	});

	it("stops when drawPile and discardPile are both empty", () => {
		const ctx = makeCtx();
		drawCards(5, ctx, rng);
		expect(ctx.state.hand).toHaveLength(0);
	});

	it("draws as many as available when count exceeds total cards", () => {
		const ctx = makeCtx({ drawPile: cards("a", "b") });
		drawCards(10, ctx, rng);
		expect(ctx.state.hand).toHaveLength(2);
	});

	it("drawing zero cards is a no-op", () => {
		const ctx = makeCtx({ drawPile: cards("a", "b", "c") });
		drawCards(0, ctx, rng);
		expect(ctx.state.hand).toHaveLength(0);
		expect(ctx.log.filter((l) => l.event.type === "CARD_DRAWN")).toHaveLength(0);
	});

	// -------------------------------------------------------------------------
	// Reshuffle on empty drawPile
	// -------------------------------------------------------------------------

	it("reshuffles discard into draw when drawPile is empty", () => {
		const ctx = makeCtx({ discardPile: cards("a", "b", "c") });
		drawCards(1, ctx, rng);
		expect(ctx.state.hand).toHaveLength(1);
		expect(ctx.state.discardPile).toHaveLength(0);
	});

	it("emits DECK_RESHUFFLED when reshuffle occurs during draw", () => {
		const ctx = makeCtx({ discardPile: cards("a", "b") });
		drawCards(1, ctx, rng);
		expect(ctx.log.some((l) => l.event.type === "DECK_RESHUFFLED")).toBe(true);
	});

	it("continues drawing after reshuffle", () => {
		// drawPile: [A], discardPile: [B, C, D] → request 4 draws
		// Draws A, exhausts drawPile → reshuffles → draws B/C/D (3 more) → total 4
		const ctx = makeCtx({
			drawPile: cards("a"),
			discardPile: cards("b", "c", "d"),
		});
		drawCards(4, ctx, rng);
		expect(ctx.state.hand).toHaveLength(4);
		expect(ctx.state.discardPile).toHaveLength(0);
	});

	it("does not reshuffle when discard is empty even if drawPile runs out", () => {
		const ctx = makeCtx({ drawPile: cards("a") });
		drawCards(5, ctx, rng);
		expect(ctx.state.hand).toHaveLength(1); // only 1 card existed
		expect(ctx.log.some((l) => l.event.type === "DECK_RESHUFFLED")).toBe(false);
	});

	it("reshuffle only fires once per drawCards call (one exhaustion of drawPile)", () => {
		// After reshuffling, discard is empty so no second reshuffle is possible
		const ctx = makeCtx({ drawPile: cards("a"), discardPile: cards("b", "c") });
		drawCards(10, ctx, rng);
		const reshuffles = ctx.log.filter((l) => l.event.type === "DECK_RESHUFFLED");
		expect(reshuffles).toHaveLength(1);
		expect(ctx.state.hand).toHaveLength(3); // a + b + c
	});

	it("all three cards are in hand after drawing through a reshuffle", () => {
		const ctx = makeCtx({ drawPile: cards("d1"), discardPile: cards("d2", "d3") });
		drawCards(3, ctx, rng);
		const ids = ctx.state.hand.map((c) => c.instanceId).sort();
		expect(ids).toEqual(["d1", "d2", "d3"]);
	});
});

// ---------------------------------------------------------------------------
// discardCard
// ---------------------------------------------------------------------------

describe("discardCard()", () => {
	it("moves a card from hand to discardPile", () => {
		const ctx = makeCtx({ hand: cards("a", "b", "c") });
		discardCard("b", ctx);
		expect(ctx.state.hand.map((c) => c.instanceId)).toEqual(["a", "c"]);
		expect(ctx.state.discardPile.map((c) => c.instanceId)).toEqual(["b"]);
	});

	it("emits CARD_DISCARDED with correct instanceId", () => {
		const ctx = makeCtx({ hand: cards("target") });
		discardCard("target", ctx);
		const ev = ctx.log.find((l) => l.event.type === "CARD_DISCARDED")?.event;
		expect(ev?.type).toBe("CARD_DISCARDED");
		if (ev?.type === "CARD_DISCARDED") expect(ev.cardInstanceId).toBe("target");
	});

	it("is a no-op when card is not in hand", () => {
		const ctx = makeCtx({ hand: cards("a") });
		discardCard("not-in-hand", ctx);
		expect(ctx.state.hand).toHaveLength(1);
		expect(ctx.state.discardPile).toHaveLength(0);
		expect(ctx.log).toHaveLength(0);
	});

	it("discards the correct card when multiple are in hand", () => {
		const ctx = makeCtx({ hand: cards("x", "y", "z") });
		discardCard("y", ctx);
		expect(ctx.state.hand).toHaveLength(2);
		expect(ctx.state.hand.some((c) => c.instanceId === "y")).toBe(false);
		expect(ctx.state.discardPile.some((c) => c.instanceId === "y")).toBe(true);
	});

	it("preserves card identity (same object reference in discard)", () => {
		const card = makeCard("ref-test");
		const ctx = makeCtx({ hand: [card] });
		discardCard("ref-test", ctx);
		expect(ctx.state.discardPile[0]).toBe(card);
	});
});

// ---------------------------------------------------------------------------
// exhaustCard
// ---------------------------------------------------------------------------

describe("exhaustCard()", () => {
	it("moves a card from hand to exhaustPile", () => {
		const ctx = makeCtx({ hand: cards("a", "b") });
		exhaustCard("a", ctx);
		expect(ctx.state.hand.map((c) => c.instanceId)).toEqual(["b"]);
		expect(ctx.state.exhaustPile.map((c) => c.instanceId)).toEqual(["a"]);
	});

	it("emits CARD_EXHAUSTED with correct instanceId", () => {
		const ctx = makeCtx({ hand: cards("exhaust-me") });
		exhaustCard("exhaust-me", ctx);
		const ev = ctx.log.find((l) => l.event.type === "CARD_EXHAUSTED")?.event;
		expect(ev?.type).toBe("CARD_EXHAUSTED");
		if (ev?.type === "CARD_EXHAUSTED") expect(ev.cardInstanceId).toBe("exhaust-me");
	});

	it("is a no-op when card is not in hand", () => {
		const ctx = makeCtx({ hand: cards("a") });
		exhaustCard("ghost", ctx);
		expect(ctx.state.hand).toHaveLength(1);
		expect(ctx.state.exhaustPile).toHaveLength(0);
	});

	it("card does NOT go to discard pile", () => {
		const ctx = makeCtx({ hand: cards("a") });
		exhaustCard("a", ctx);
		expect(ctx.state.discardPile).toHaveLength(0);
		expect(ctx.state.exhaustPile).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// discardHand
// ---------------------------------------------------------------------------

describe("discardHand()", () => {
	it("moves all hand cards to discardPile", () => {
		const ctx = makeCtx({ hand: cards("a", "b", "c") });
		discardHand(ctx);
		expect(ctx.state.hand).toHaveLength(0);
		expect(ctx.state.discardPile.map((c) => c.instanceId).sort()).toEqual(["a", "b", "c"]);
	});

	it("emits CARD_DISCARDED for each card", () => {
		const ctx = makeCtx({ hand: cards("x", "y") });
		discardHand(ctx);
		const events = ctx.log.filter((l) => l.event.type === "CARD_DISCARDED");
		expect(events).toHaveLength(2);
	});

	it("is a no-op on an empty hand", () => {
		const ctx = makeCtx();
		discardHand(ctx);
		expect(ctx.state.hand).toHaveLength(0);
		expect(ctx.state.discardPile).toHaveLength(0);
		expect(ctx.log).toHaveLength(0);
	});

	it("preserves card identities in discard pile", () => {
		const handCards = cards("p", "q", "r");
		const ctx = makeCtx({ hand: handCards });
		discardHand(ctx);
		const discardIds = ctx.state.discardPile.map((c) => c.instanceId).sort();
		expect(discardIds).toEqual(["p", "q", "r"]);
	});

	it("does not affect cards already in discard pile", () => {
		const ctx = makeCtx({ hand: cards("h1"), discardPile: cards("d1", "d2") });
		discardHand(ctx);
		expect(ctx.state.discardPile).toHaveLength(3); // d1, d2, h1
	});
});

// ---------------------------------------------------------------------------
// reshuffleDiscard
// ---------------------------------------------------------------------------

describe("reshuffleDiscard()", () => {
	it("moves all discard cards to drawPile", () => {
		const ctx = makeCtx({ discardPile: cards("a", "b", "c") });
		reshuffleDiscard(ctx, rng);
		expect(ctx.state.drawPile).toHaveLength(3);
		expect(ctx.state.discardPile).toHaveLength(0);
	});

	it("emits DECK_RESHUFFLED", () => {
		const ctx = makeCtx({ discardPile: cards("a") });
		reshuffleDiscard(ctx, rng);
		expect(ctx.log.some((l) => l.event.type === "DECK_RESHUFFLED")).toBe(true);
	});

	it("all cards are preserved after reshuffle", () => {
		const ctx = makeCtx({ discardPile: cards("a", "b", "c") });
		reshuffleDiscard(ctx, rng);
		const ids = ctx.state.drawPile.map((c) => c.instanceId).sort();
		expect(ids).toEqual(["a", "b", "c"]);
	});

	it("is a no-op when discardPile is empty", () => {
		const ctx = makeCtx({ drawPile: cards("existing") });
		reshuffleDiscard(ctx, rng);
		expect(ctx.state.drawPile).toHaveLength(1); // unchanged
		expect(ctx.log).toHaveLength(0); // no event emitted
	});

	it("does not emit DECK_RESHUFFLED when discardPile is empty", () => {
		const ctx = makeCtx();
		reshuffleDiscard(ctx, rng);
		expect(ctx.log.some((l) => l.event.type === "DECK_RESHUFFLED")).toBe(false);
	});

	it("different seeds produce different draw pile orders", () => {
		const deck = cards("a", "b", "c", "d", "e");

		const ctx1 = makeCtx({ discardPile: [...deck] });
		reshuffleDiscard(ctx1, new Rng(1));

		const ctx2 = makeCtx({ discardPile: [...deck] });
		reshuffleDiscard(ctx2, new Rng(2));

		const order1 = ctx1.state.drawPile.map((c) => c.instanceId);
		const order2 = ctx2.state.drawPile.map((c) => c.instanceId);
		expect(order1).not.toEqual(order2);
	});

	it("same seed produces same draw pile order (deterministic)", () => {
		const deck = cards("a", "b", "c", "d", "e");

		const ctx1 = makeCtx({ discardPile: [...deck] });
		reshuffleDiscard(ctx1, new Rng(99));

		const ctx2 = makeCtx({ discardPile: [...deck] });
		reshuffleDiscard(ctx2, new Rng(99));

		expect(ctx1.state.drawPile.map((c) => c.instanceId)).toEqual(
			ctx2.state.drawPile.map((c) => c.instanceId),
		);
	});

	it("existing drawPile is replaced by the reshuffled cards", () => {
		const ctx = makeCtx({
			drawPile: cards("old"),
			discardPile: cards("new1", "new2"),
		});
		reshuffleDiscard(ctx, rng);
		// After reshuffle, drawPile contains only the reshuffled discard
		expect(ctx.state.drawPile).toHaveLength(2);
		expect(ctx.state.drawPile.some((c) => c.instanceId === "old")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Integration: full turn cycle
// ---------------------------------------------------------------------------

describe("full turn cycle", () => {
	it("draw → play → discard hand → next turn draw", () => {
		const deck = cards("a", "b", "c", "d", "e");
		const ctx = makeCtx({ drawPile: [...deck] });

		// Turn 1: draw 3
		drawCards(3, ctx, rng);
		expect(ctx.state.hand).toHaveLength(3);

		// Discard one card explicitly (simulating playing it)
		const played = ctx.state.hand[0];
		if (played === undefined) throw new Error("no card drawn");
		discardCard(played.instanceId, ctx);
		expect(ctx.state.hand).toHaveLength(2);

		// End of turn: discard remaining hand
		discardHand(ctx);
		expect(ctx.state.hand).toHaveLength(0);
		expect(ctx.state.discardPile).toHaveLength(3); // 3 discarded total

		// Turn 2: draw 5, exhausting drawPile (2 left) then reshuffling
		drawCards(5, ctx, rng);
		expect(ctx.state.hand).toHaveLength(5); // 2 from draw + 3 reshuffled
		expect(ctx.log.some((l) => l.event.type === "DECK_RESHUFFLED")).toBe(true);
	});

	it("exhaust does not return to any pile after discard hand", () => {
		const ctx = makeCtx({ hand: cards("mortal", "immortal") });
		exhaustCard("mortal", ctx);
		discardHand(ctx);
		expect(ctx.state.exhaustPile.map((c) => c.instanceId)).toEqual(["mortal"]);
		expect(ctx.state.discardPile.map((c) => c.instanceId)).toEqual(["immortal"]);
	});
});
