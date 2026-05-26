import type { CombatContext } from "@core/combat/effects/effect-handler.ts";
import type { Rng } from "@core/rng/rng.ts";

export const MAX_HAND_SIZE = 10;

// ---------------------------------------------------------------------------
// drawCards
// ---------------------------------------------------------------------------

/**
 * Draws up to `count` cards from the draw pile into the hand.
 * - Stops early if hand reaches MAX_HAND_SIZE.
 * - Shuffles discard pile into draw pile (emitting DECK_RESHUFFLED) when the
 *   draw pile runs out, then continues drawing.
 * - Stops if both piles are empty.
 */
export function drawCards(count: number, ctx: CombatContext, rng: Rng): void {
	const state = ctx.state;
	for (let i = 0; i < count; i++) {
		if (state.hand.length >= MAX_HAND_SIZE) break;

		if (state.drawPile.length === 0) {
			if (state.discardPile.length === 0) break;
			reshuffleDiscard(ctx, rng);
		}

		const card = state.drawPile.pop();
		if (card === undefined) break;

		state.hand.push(card);
		ctx.emit({ type: "CARD_DRAWN", cardInstanceId: card.instanceId });
	}
}

// ---------------------------------------------------------------------------
// discardCard / exhaustCard
// ---------------------------------------------------------------------------

/**
 * Moves a card from hand to the discard pile.
 * No-op if the card is not currently in hand.
 */
export function discardCard(instanceId: string, ctx: CombatContext): void {
	const state = ctx.state;
	const idx = state.hand.findIndex((c) => c.instanceId === instanceId);
	if (idx === -1) return;

	const [card] = state.hand.splice(idx, 1);
	if (card === undefined) return;

	state.discardPile.push(card);
	ctx.emit({ type: "CARD_DISCARDED", cardInstanceId: instanceId });
}

/**
 * Moves a card from hand to the exhaust pile.
 * No-op if the card is not currently in hand.
 */
export function exhaustCard(instanceId: string, ctx: CombatContext): void {
	const state = ctx.state;
	const idx = state.hand.findIndex((c) => c.instanceId === instanceId);
	if (idx === -1) return;

	const [card] = state.hand.splice(idx, 1);
	if (card === undefined) return;

	state.exhaustPile.push(card);
	ctx.emit({ type: "CARD_EXHAUSTED", cardInstanceId: instanceId });
}

// ---------------------------------------------------------------------------
// discardHand
// ---------------------------------------------------------------------------

/** Discards every card in hand (called at end of player turn). */
export function discardHand(ctx: CombatContext): void {
	const state = ctx.state;
	for (const card of state.hand) {
		state.discardPile.push(card);
		ctx.emit({ type: "CARD_DISCARDED", cardInstanceId: card.instanceId });
	}
	state.hand = [];
}

// ---------------------------------------------------------------------------
// reshuffleDiscard
// ---------------------------------------------------------------------------

/**
 * Shuffles the discard pile into the draw pile and emits DECK_RESHUFFLED.
 * No-op when the discard pile is empty.
 */
export function reshuffleDiscard(ctx: CombatContext, rng: Rng): void {
	const state = ctx.state;
	if (state.discardPile.length === 0) return;

	state.drawPile = rng.shuffle(state.discardPile);
	state.discardPile = [];
	ctx.emit({ type: "DECK_RESHUFFLED" });
}
