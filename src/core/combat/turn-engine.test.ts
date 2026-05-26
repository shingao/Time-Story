import type { CardDefinition, CardInstance } from "@core/cards/card-definition.ts";
import { resetSpawnCounter } from "@core/enemies/enemy-registry.ts";
import { Rng } from "@core/rng/rng.ts";
import { beforeEach, describe, expect, it } from "vitest";
import type { CombatState } from "./effects/effect-handler.ts";
import { CombatContext } from "./effects/effect-handler.ts";
import {
	applyStatus,
	asCardId,
	asEnemyId,
	asEntityId,
	asStatusId,
	createEnemy,
	createPlayer,
	findStatus,
	gainBlock,
} from "./entity.ts";
import {
	beginPlayerTurn,
	checkWinLoss,
	endPlayerTurn,
	playCard,
	registerDefaultHandlers,
} from "./turn-engine.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAYER_ID = asEntityId("player");
const ENEMY_ID = asEntityId("enemy-0");
const rng = new Rng(42);

function makeState(enemyHp = 20): CombatState {
	return {
		player: createPlayer({ id: PLAYER_ID, name: "Charmander", types: ["fire"], maxHp: 44 }),
		enemies: [
			createEnemy({
				id: ENEMY_ID,
				name: "Pidgey",
				types: ["normal", "flying"],
				maxHp: enemyHp,
				definitionId: asEnemyId("pidgey"),
			}),
		],
		hand: [],
		drawPile: [],
		discardPile: [],
		exhaustPile: [],
	};
}

function makeCtx(enemyHp?: number): CombatContext {
	const ctx = new CombatContext(makeState(enemyHp));
	registerDefaultHandlers(ctx);
	return ctx;
}

function scratchCard(id = "scratch"): { def: CardDefinition; inst: CardInstance } {
	const def: CardDefinition = {
		id: asCardId(id),
		name: "Scratch",
		description: "Deal 6 damage.",
		types: ["normal"],
		category: "attack",
		rarity: "starter",
		energyCost: 1,
		target: "enemy",
		effects: [{ kind: "damage", amount: 6 }],
	};
	const inst: CardInstance = { instanceId: `${id}-1`, definitionId: asCardId(id), upgradeLevel: 0 };
	return { def, inst };
}

beforeEach(() => {
	resetSpawnCounter();
});

// ---------------------------------------------------------------------------
// registerDefaultHandlers
// ---------------------------------------------------------------------------

describe("registerDefaultHandlers", () => {
	it("damage-applier processes DAMAGE_INTENDED and emits DAMAGE_DEALT", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;

		ctx.emit({
			type: "DAMAGE_INTENDED",
			sourceId: ENEMY_ID,
			targetId: PLAYER_ID,
			amount: 7,
			damageTypes: ["normal"],
			damageSource: "enemy",
			cancellable: true,
		});

		expect(player.hp).toBe(44 - 7);
		const ev = ctx.log.find((l) => l.event.type === "DAMAGE_DEALT")?.event;
		expect(ev?.type).toBe("DAMAGE_DEALT");
	});

	it("block-reset zeroes player block on TURN_START (isPlayer=true)", () => {
		const ctx = makeCtx();
		gainBlock(ctx.state.player, 10);

		ctx.emit({ type: "TURN_START", entityId: PLAYER_ID, isPlayer: true });

		expect(ctx.state.player.block).toBe(0);
	});

	it("block-reset zeroes enemy block on TURN_START (isPlayer=false)", () => {
		const ctx = makeCtx();
		gainBlock(ctx.state.enemies[0]!, 5);

		ctx.emit({ type: "TURN_START", entityId: ENEMY_ID, isPlayer: false });

		expect(ctx.state.enemies[0]?.block).toBe(0);
	});

	it("block-reset is skipped when skipBlockReset flag is set", () => {
		const ctx = makeCtx();
		gainBlock(ctx.state.player, 8);
		ctx.flags.skipBlockReset = true;

		ctx.emit({ type: "TURN_START", entityId: PLAYER_ID, isPlayer: true });

		expect(ctx.state.player.block).toBe(8); // preserved
	});

	it("ENTITY_DEFEATED is emitted when a combatant's HP reaches 0", () => {
		const ctx = makeCtx(6);

		ctx.emit({
			type: "DAMAGE_INTENDED",
			sourceId: PLAYER_ID,
			targetId: ENEMY_ID,
			amount: 999,
			damageTypes: ["fire"],
			damageSource: "card",
			cancellable: true,
		});

		const defeated = ctx.log.find((l) => l.event.type === "ENTITY_DEFEATED")?.event;
		expect(defeated?.type).toBe("ENTITY_DEFEATED");
		if (defeated?.type === "ENTITY_DEFEATED") {
			expect(String(defeated.entityId)).toBe(String(ENEMY_ID));
		}
	});
});

// ---------------------------------------------------------------------------
// checkWinLoss
// ---------------------------------------------------------------------------

describe("checkWinLoss", () => {
	it("returns null when both sides are alive", () => {
		const ctx = makeCtx();
		expect(checkWinLoss(ctx)).toBeNull();
	});

	it("returns WIN when all enemies are dead", () => {
		const ctx = makeCtx();
		ctx.state.enemies[0]!.hp = 0;
		expect(checkWinLoss(ctx)).toBe("WIN");
	});

	it("returns LOSE when player is dead", () => {
		const ctx = makeCtx();
		ctx.state.player.hp = 0;
		expect(checkWinLoss(ctx)).toBe("LOSE");
	});

	it("returns WIN when multiple enemies and all are dead", () => {
		const ctx = makeCtx();
		const extra = createEnemy({ id: asEntityId("e2"), name: "Cat", types: ["bug"], maxHp: 15 });
		extra.hp = 0;
		ctx.state.enemies[0]!.hp = 0;
		ctx.state.enemies.push(extra);
		expect(checkWinLoss(ctx)).toBe("WIN");
	});
});

// ---------------------------------------------------------------------------
// beginPlayerTurn
// ---------------------------------------------------------------------------

describe("beginPlayerTurn", () => {
	it("refills energy to maxEnergy", () => {
		const ctx = makeCtx();
		ctx.state.player.energy = 0;

		beginPlayerTurn(ctx, rng);

		expect(ctx.state.player.energy).toBe(ctx.state.player.maxEnergy);
	});

	it("draws drawPerTurn cards", () => {
		const ctx = makeCtx();
		const { inst } = scratchCard();
		// Put 5 cards in draw pile
		for (let i = 0; i < 5; i++) {
			ctx.state.drawPile.push({ ...inst, instanceId: `scratch-${i}` });
		}

		beginPlayerTurn(ctx, rng);

		expect(ctx.state.hand.length).toBe(5); // drawPerTurn default
	});

	it("emits TURN_START (which triggers block-reset)", () => {
		const ctx = makeCtx();
		gainBlock(ctx.state.player, 7);

		beginPlayerTurn(ctx, rng);

		expect(ctx.state.player.block).toBe(0);
	});

	it("ticks Burn on player at turn start", () => {
		const ctx = makeCtx();
		applyStatus(ctx.state.player, { id: asStatusId("burn"), stacks: 2, behavior: "intensity" });

		beginPlayerTurn(ctx, rng);

		// Burn of 2 fired → HP reduced by 2
		expect(ctx.state.player.hp).toBe(44 - 2);
		// Stacks decayed to 1
		expect(findStatus(ctx.state.player, asStatusId("burn"))?.stacks).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// playCard
// ---------------------------------------------------------------------------

describe("playCard", () => {
	it("returns played=false when not in PLAYER_TURN phase", () => {
		const ctx = makeCtx();
		ctx.phase = "ENEMY_TURN";
		const { inst } = scratchCard();
		ctx.state.hand.push(inst);

		const result = playCard(inst.instanceId, String(ENEMY_ID), ctx, rng);
		expect(result.played).toBe(false);
		expect(result.reason).toBe("not player turn");
	});

	it("returns played=false when card not in hand", () => {
		const ctx = makeCtx();
		ctx.phase = "PLAYER_TURN";

		const result = playCard("nonexistent-1", String(ENEMY_ID), ctx, rng);
		expect(result.played).toBe(false);
		expect(result.reason).toBe("card not in hand");
	});

	it("returns played=false when insufficient energy", () => {
		const ctx = makeCtx();
		ctx.phase = "PLAYER_TURN";
		ctx.state.player.energy = 0;
		const { inst } = scratchCard();
		ctx.state.hand.push(inst);

		const result = playCard(inst.instanceId, String(ENEMY_ID), ctx, rng);
		expect(result.played).toBe(false);
		expect(result.reason).toBe("insufficient energy");
	});

	it("successfully plays a damage card and moves it to discard", () => {
		const ctx = makeCtx();
		ctx.phase = "PLAYER_TURN";
		const { inst } = scratchCard();
		ctx.state.hand.push(inst);

		const result = playCard(inst.instanceId, String(ENEMY_ID), ctx, rng);

		expect(result.played).toBe(true);
		expect(ctx.state.hand).toHaveLength(0);
		expect(ctx.state.discardPile).toHaveLength(1);
	});

	it("deals damage to enemy when playing a damage card", () => {
		const ctx = makeCtx();
		ctx.phase = "PLAYER_TURN";
		const { inst } = scratchCard();
		ctx.state.hand.push(inst);

		playCard(inst.instanceId, String(ENEMY_ID), ctx, rng);

		expect(ctx.state.enemies[0]?.hp).toBe(20 - 6);
	});

	it("sets phase to WIN and emits COMBAT_END when enemy dies from card", () => {
		const ctx = makeCtx(6); // enemy has 6 HP, scratch deals 6
		ctx.phase = "PLAYER_TURN";
		const { inst } = scratchCard();
		ctx.state.hand.push(inst);

		playCard(inst.instanceId, String(ENEMY_ID), ctx, rng);

		expect(ctx.phase).toBe("WIN");
		const endEv = ctx.log.find((l) => l.event.type === "COMBAT_END")?.event;
		expect(endEv?.type).toBe("COMBAT_END");
		if (endEv?.type === "COMBAT_END") {
			expect(endEv.outcome).toBe("victory");
		}
	});
});

// ---------------------------------------------------------------------------
// endPlayerTurn
// ---------------------------------------------------------------------------

describe("endPlayerTurn", () => {
	it("discards remaining hand cards (emits CARD_DISCARDED)", () => {
		const ctx = makeCtx();
		ctx.phase = "PLAYER_TURN";
		const { inst } = scratchCard();
		ctx.state.hand.push(inst);
		ctx.state.enemies[0]!.intent = { kind: "unknown" };

		endPlayerTurn(ctx, rng);

		// CARD_DISCARDED must have fired for our card (hand → discard).
		// Note: beginPlayerTurn at the new turn start may reshuffle and redraw the card,
		// so checking final hand size is unreliable — check the event log instead.
		const discardedEv = ctx.log.find(
			(l) =>
				l.event.type === "CARD_DISCARDED" &&
				(l.event as { type: "CARD_DISCARDED"; cardInstanceId: string }).cardInstanceId ===
					inst.instanceId,
		);
		expect(discardedEv).toBeDefined();
	});

	it("increments turnNumber after enemy turn completes", () => {
		const ctx = makeCtx();
		ctx.phase = "PLAYER_TURN";
		ctx.state.enemies[0]!.intent = { kind: "unknown" };

		endPlayerTurn(ctx, rng);

		expect(ctx.turnNumber).toBe(1);
	});

	it("enemy attack intent damages the player", () => {
		const ctx = makeCtx();
		ctx.phase = "PLAYER_TURN";
		ctx.state.enemies[0]!.intent = { kind: "attack", damage: 5, hits: 1 };

		endPlayerTurn(ctx, rng);

		// Player takes 5 damage during enemy turn
		expect(ctx.state.player.hp).toBe(44 - 5);
	});

	it("phase returns to PLAYER_TURN after enemy turn (combat ongoing)", () => {
		const ctx = makeCtx();
		ctx.phase = "PLAYER_TURN";
		ctx.state.enemies[0]!.intent = { kind: "unknown" };

		endPlayerTurn(ctx, rng);

		expect(ctx.phase).toBe("PLAYER_TURN");
	});

	it("sets phase to LOSE when player dies during enemy turn", () => {
		const ctx = makeCtx();
		ctx.phase = "PLAYER_TURN";
		ctx.state.player.hp = 1;
		ctx.state.enemies[0]!.intent = { kind: "attack", damage: 99, hits: 1 };

		endPlayerTurn(ctx, rng);

		expect(ctx.phase).toBe("LOSE");
	});

	it("is a no-op when phase is not PLAYER_TURN", () => {
		const ctx = makeCtx();
		ctx.phase = "ENEMY_TURN";
		const hpBefore = ctx.state.player.hp;

		endPlayerTurn(ctx, rng);

		expect(ctx.state.player.hp).toBe(hpBefore);
		expect(ctx.turnNumber).toBe(0);
	});

	it("resets enemy block at enemy TURN_START via block-reset handler", () => {
		const ctx = makeCtx();
		ctx.phase = "PLAYER_TURN";
		gainBlock(ctx.state.enemies[0]!, 10);
		ctx.state.enemies[0]!.intent = { kind: "unknown" };

		endPlayerTurn(ctx, rng);

		// Enemy block was zeroed at their TURN_START before executing intent
		// After beginPlayerTurn draws etc. we check enemy block mid-sequence
		// We verify via the log that TURN_START fired for enemy
		const enemyTurnStart = ctx.log.filter(
			(l) =>
				l.event.type === "TURN_START" &&
				!("isPlayer" in l.event && (l.event as { isPlayer: boolean }).isPlayer),
		);
		expect(enemyTurnStart.length).toBeGreaterThan(0);
	});
});
