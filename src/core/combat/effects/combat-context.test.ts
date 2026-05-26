import { describe, expect, it, vi } from "vitest";
import type { Enemy } from "../entity.ts";
import { asEntityId, asStatusId, createEnemy, createPlayer, takeDamage } from "../entity.ts";
import type { CombatState, EffectHandler } from "./effect-handler.ts";
import { CombatContext } from "./effect-handler.ts";
import type { GameEvent } from "./game-events.ts";
import { withAmount } from "./game-events.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
				id: asEntityId("enemy-1"),
				name: "Pidgey",
				types: ["normal", "flying"],
				maxHp: 20,
			}),
		],
		hand: [],
		drawPile: [],
		discardPile: [],
		exhaustPile: [],
	};
}

function makeCtx(): CombatContext {
	return new CombatContext(makeState());
}

/** Safe accessor for the single enemy in test contexts — throws if missing. */
function firstEnemy(ctx: CombatContext): Enemy {
	const e = ctx.getEnemies()[0];
	if (e === undefined) throw new Error("test setup: no enemies in context");
	return e;
}

type DamageIntended = Extract<GameEvent, { type: "DAMAGE_INTENDED" }>;
type TurnEnd = Extract<GameEvent, { type: "TURN_END" }>;

function damageIntended(amount: number, targetId = asEntityId("enemy-1")): DamageIntended {
	return {
		type: "DAMAGE_INTENDED",
		sourceId: asEntityId("player"),
		targetId,
		amount,
		damageTypes: ["fire"],
		cancellable: true,
	};
}

function turnEnd(entityId = asEntityId("player"), isPlayer = true): TurnEnd {
	return { type: "TURN_END", entityId, isPlayer };
}

// ---------------------------------------------------------------------------
// Basic emit — no handlers
// ---------------------------------------------------------------------------

describe("CombatContext.emit — no handlers", () => {
	it("returns the original event unchanged", () => {
		const ctx = makeCtx();
		const event = damageIntended(10);
		const result = ctx.emit(event);
		expect(result).toEqual(event);
	});

	it("logs the event with cancelled=false", () => {
		const ctx = makeCtx();
		ctx.emit(damageIntended(10));
		expect(ctx.log).toHaveLength(1);
		expect(ctx.log[0]?.cancelled).toBe(false);
	});

	it("increments tick on each emit", () => {
		const ctx = makeCtx();
		ctx.emit(damageIntended(5));
		ctx.emit(damageIntended(5));
		expect(ctx.log[0]?.tick).toBe(0);
		expect(ctx.log[1]?.tick).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Strength buff handler — modifies DAMAGE_INTENDED amount
// ---------------------------------------------------------------------------

describe("Strength buff handler", () => {
	function makeStrengthHandler(stacks: number): EffectHandler {
		return {
			id: "strength-buff",
			priority: 10,
			on: "DAMAGE_INTENDED",
			handle(event, _ctx) {
				if (event.type !== "DAMAGE_INTENDED") return event;
				return withAmount(event, event.amount + stacks);
			},
		};
	}

	it("increases damage amount by buff stacks", () => {
		const ctx = makeCtx();
		ctx.registerHandler(makeStrengthHandler(3));
		const result = ctx.emit(damageIntended(10)) as DamageIntended | null;
		expect(result?.amount).toBe(13);
	});

	it("two strength handlers stack additively", () => {
		const ctx = makeCtx();
		ctx.registerHandler(makeStrengthHandler(2));
		ctx.registerHandler({ ...makeStrengthHandler(3), id: "strength-buff-2" });
		const result = ctx.emit(damageIntended(10)) as DamageIntended | null;
		expect(result?.amount).toBe(15);
	});

	it("does not affect events it doesn't subscribe to", () => {
		const ctx = makeCtx();
		ctx.registerHandler(makeStrengthHandler(5));
		const te = turnEnd();
		const result = ctx.emit(te);
		expect(result).toEqual(te);
	});

	it("logs the transformed event", () => {
		const ctx = makeCtx();
		ctx.registerHandler(makeStrengthHandler(2));
		ctx.emit(damageIntended(10));
		const logged = ctx.log[0]?.event as DamageIntended;
		expect(logged?.amount).toBe(12);
	});
});

// ---------------------------------------------------------------------------
// Burn status handler — deals damage at TURN_END
// ---------------------------------------------------------------------------

describe("Burn status handler", () => {
	function makeBurnHandler(): EffectHandler {
		return {
			id: "burn-tick",
			priority: 20,
			on: "TURN_END",
			handle(event, ctx) {
				if (event.type !== "TURN_END") return event;
				const target = ctx.getCombatant(event.entityId);
				if (target === undefined) return event;
				const burn = target.statuses.find((s) => s.id === asStatusId("burn"));
				if (burn === undefined) return event;

				const burnDamage = burn.stacks * 2;
				takeDamage(target, burnDamage);

				// Emit the observational DAMAGE_DEALT (recursive emit)
				ctx.emit({
					type: "DAMAGE_DEALT",
					sourceId: asEntityId("burn"),
					targetId: target.id,
					finalAmount: burnDamage,
				});

				return event; // TURN_END itself continues unchanged
			},
		};
	}

	it("deals 2 damage per burn stack at end of entity turn", () => {
		const ctx = makeCtx();
		ctx.registerHandler(makeBurnHandler());

		const enemy = firstEnemy(ctx);
		enemy.statuses.push({ id: asStatusId("burn"), stacks: 3, behavior: "intensity" });

		ctx.emit(turnEnd(enemy.id, false));

		expect(enemy.hp).toBe(20 - 6); // 3 stacks * 2 = 6
	});

	it("does nothing if entity has no burn", () => {
		const ctx = makeCtx();
		ctx.registerHandler(makeBurnHandler());
		const enemy = firstEnemy(ctx);

		ctx.emit(turnEnd(enemy.id, false));

		expect(enemy.hp).toBe(20); // untouched
	});

	it("emits DAMAGE_DEALT as a nested event (recursive)", () => {
		const ctx = makeCtx();
		ctx.registerHandler(makeBurnHandler());

		const enemy = firstEnemy(ctx);
		enemy.statuses.push({ id: asStatusId("burn"), stacks: 1, behavior: "intensity" });

		ctx.emit(turnEnd(enemy.id, false));

		// Log: DAMAGE_DEALT (inner, tick 0) then TURN_END (outer, tick 1)
		expect(ctx.log).toHaveLength(2);
		expect(ctx.log[0]?.event.type).toBe("DAMAGE_DEALT");
		expect(ctx.log[1]?.event.type).toBe("TURN_END");
	});

	it("does not affect the player's turn end when enemy has burn", () => {
		const ctx = makeCtx();
		ctx.registerHandler(makeBurnHandler());

		const enemy = firstEnemy(ctx);
		enemy.statuses.push({ id: asStatusId("burn"), stacks: 5, behavior: "intensity" });

		// Player turn end — burn handler looks at player, player has no burn
		ctx.emit(turnEnd(asEntityId("player"), true));

		expect(enemy.hp).toBe(20); // enemy not damaged by player's turn end
	});
});

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

describe("Cancellation (DAMAGE_INTENDED with cancellable: true)", () => {
	const cancelHandler: EffectHandler = {
		id: "shield-cancel",
		priority: 5,
		on: "DAMAGE_INTENDED",
		handle: () => null, // always cancels
	};

	it("returns null when a handler cancels a cancellable event", () => {
		const ctx = makeCtx();
		ctx.registerHandler(cancelHandler);
		const result = ctx.emit(damageIntended(10));
		expect(result).toBeNull();
	});

	it("logs the event as cancelled", () => {
		const ctx = makeCtx();
		ctx.registerHandler(cancelHandler);
		ctx.emit(damageIntended(10));
		expect(ctx.log[0]?.cancelled).toBe(true);
	});

	it("handlers after a cancel are not called", () => {
		const ctx = makeCtx();
		const afterCancel = vi.fn().mockReturnValue(damageIntended(10));
		ctx.registerHandler(cancelHandler); // priority 5 — runs first
		ctx.registerHandler({
			id: "after-cancel",
			priority: 100,
			on: "DAMAGE_INTENDED",
			handle: afterCancel,
		});
		ctx.emit(damageIntended(10));
		expect(afterCancel).not.toHaveBeenCalled();
	});

	it("null return on non-cancellable event is treated as pass-through", () => {
		const ctx = makeCtx();
		const te = turnEnd();
		ctx.registerHandler({
			id: "null-passthrough",
			priority: 10,
			on: "TURN_END",
			handle: () => null, // null on non-cancellable
		});
		const result = ctx.emit(te);
		// Should NOT be null — pass-through
		expect(result).toEqual(te);
	});
});

// ---------------------------------------------------------------------------
// Priority ordering
// ---------------------------------------------------------------------------

describe("Handler priority ordering", () => {
	it("lower priority runs first", () => {
		const ctx = makeCtx();
		const order: number[] = [];

		ctx.registerHandler({
			id: "h-50",
			priority: 50,
			on: "DAMAGE_INTENDED",
			handle(e) {
				order.push(50);
				return e;
			},
		});
		ctx.registerHandler({
			id: "h-10",
			priority: 10,
			on: "DAMAGE_INTENDED",
			handle(e) {
				order.push(10);
				return e;
			},
		});
		ctx.registerHandler({
			id: "h-30",
			priority: 30,
			on: "DAMAGE_INTENDED",
			handle(e) {
				order.push(30);
				return e;
			},
		});

		ctx.emit(damageIntended(5));
		expect(order).toEqual([10, 30, 50]);
	});

	it("each handler receives the output of the previous one", () => {
		const ctx = makeCtx();

		// priority 10: +5
		ctx.registerHandler({
			id: "add-5",
			priority: 10,
			on: "DAMAGE_INTENDED",
			handle(e) {
				return withAmount(e as DamageIntended, (e as DamageIntended).amount + 5);
			},
		});
		// priority 20: *2
		ctx.registerHandler({
			id: "double",
			priority: 20,
			on: "DAMAGE_INTENDED",
			handle(e) {
				return withAmount(e as DamageIntended, (e as DamageIntended).amount * 2);
			},
		});

		// 10 +5 = 15, *2 = 30
		const result = ctx.emit(damageIntended(10)) as DamageIntended | null;
		expect(result?.amount).toBe(30);
	});

	it("handlers registered in reverse priority order still run correctly", () => {
		const ctx = makeCtx();
		const order: string[] = [];

		ctx.registerHandler({
			id: "c",
			priority: 30,
			on: "DAMAGE_INTENDED",
			handle(e) {
				order.push("c");
				return e;
			},
		});
		ctx.registerHandler({
			id: "a",
			priority: 10,
			on: "DAMAGE_INTENDED",
			handle(e) {
				order.push("a");
				return e;
			},
		});
		ctx.registerHandler({
			id: "b",
			priority: 20,
			on: "DAMAGE_INTENDED",
			handle(e) {
				order.push("b");
				return e;
			},
		});

		ctx.emit(damageIntended(5));
		expect(order).toEqual(["a", "b", "c"]);
	});
});

// ---------------------------------------------------------------------------
// Register / Unregister
// ---------------------------------------------------------------------------

describe("registerHandler / unregisterHandler", () => {
	it("registered handler fires", () => {
		const ctx = makeCtx();
		const fn = vi.fn().mockImplementation((e: GameEvent) => e);
		ctx.registerHandler({ id: "spy", priority: 10, on: "DAMAGE_INTENDED", handle: fn });
		ctx.emit(damageIntended(10));
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("unregistered handler does not fire", () => {
		const ctx = makeCtx();
		const fn = vi.fn().mockImplementation((e: GameEvent) => e);
		ctx.registerHandler({ id: "spy", priority: 10, on: "DAMAGE_INTENDED", handle: fn });
		ctx.unregisterHandler("spy");
		ctx.emit(damageIntended(10));
		expect(fn).not.toHaveBeenCalled();
	});

	it("unregistering unknown id is a no-op", () => {
		const ctx = makeCtx();
		expect(() => ctx.unregisterHandler("does-not-exist")).not.toThrow();
	});

	it("registering same id twice results in two calls (ids are not unique-enforced)", () => {
		const ctx = makeCtx();
		const fn = vi.fn().mockImplementation((e: GameEvent) => e);
		ctx.registerHandler({ id: "spy", priority: 10, on: "DAMAGE_INTENDED", handle: fn });
		ctx.registerHandler({ id: "spy", priority: 20, on: "DAMAGE_INTENDED", handle: fn });
		ctx.emit(damageIntended(10));
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("unregistering removes ALL handlers with that id", () => {
		const ctx = makeCtx();
		const fn = vi.fn().mockImplementation((e: GameEvent) => e);
		ctx.registerHandler({ id: "spy", priority: 10, on: "DAMAGE_INTENDED", handle: fn });
		ctx.registerHandler({ id: "spy", priority: 20, on: "DAMAGE_INTENDED", handle: fn });
		ctx.unregisterHandler("spy");
		ctx.emit(damageIntended(10));
		expect(fn).not.toHaveBeenCalled();
	});

	it("unregistering one handler leaves others intact", () => {
		const ctx = makeCtx();
		const fn1 = vi.fn().mockImplementation((e: GameEvent) => e);
		const fn2 = vi.fn().mockImplementation((e: GameEvent) => e);
		ctx.registerHandler({ id: "h1", priority: 10, on: "DAMAGE_INTENDED", handle: fn1 });
		ctx.registerHandler({ id: "h2", priority: 20, on: "DAMAGE_INTENDED", handle: fn2 });
		ctx.unregisterHandler("h1");
		ctx.emit(damageIntended(10));
		expect(fn1).not.toHaveBeenCalled();
		expect(fn2).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// getCombatant / getPlayer / getEnemies
// ---------------------------------------------------------------------------

describe("State accessors", () => {
	it("getCombatant returns player by id", () => {
		const ctx = makeCtx();
		const c = ctx.getCombatant(asEntityId("player"));
		expect(c?.name).toBe("Charmander");
	});

	it("getCombatant returns enemy by id", () => {
		const ctx = makeCtx();
		const c = ctx.getCombatant(asEntityId("enemy-1"));
		expect(c?.name).toBe("Pidgey");
	});

	it("getCombatant returns undefined for unknown id", () => {
		const ctx = makeCtx();
		expect(ctx.getCombatant(asEntityId("nobody"))).toBeUndefined();
	});

	it("getPlayer returns the player", () => {
		const ctx = makeCtx();
		expect(ctx.getPlayer().name).toBe("Charmander");
	});

	it("getEnemies returns enemy list", () => {
		const ctx = makeCtx();
		expect(ctx.getEnemies()).toHaveLength(1);
	});

	it("removeEnemy removes the enemy", () => {
		const ctx = makeCtx();
		ctx.removeEnemy(asEntityId("enemy-1"));
		expect(ctx.getEnemies()).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Two-phase damage integration (DAMAGE_INTENDED → DAMAGE_DEALT pattern)
// ---------------------------------------------------------------------------

describe("Two-phase damage pattern", () => {
	it("Strength modifier flows into the final DAMAGE_DEALT amount", () => {
		const ctx = makeCtx();
		const dealtAmounts: number[] = [];

		// Strength: +3 to DAMAGE_INTENDED
		ctx.registerHandler({
			id: "strength",
			priority: 10,
			on: "DAMAGE_INTENDED",
			handle(e) {
				return withAmount(e as DamageIntended, (e as DamageIntended).amount + 3);
			},
		});

		// Observer on DAMAGE_DEALT — records final amount
		ctx.registerHandler({
			id: "damage-dealt-observer",
			priority: 10,
			on: "DAMAGE_DEALT",
			handle(e) {
				if (e.type === "DAMAGE_DEALT") dealtAmounts.push(e.finalAmount);
				return e;
			},
		});

		// Simulate engine: emit DAMAGE_INTENDED, apply result, emit DAMAGE_DEALT
		const resolved = ctx.emit(damageIntended(10)) as DamageIntended | null;
		expect(resolved).not.toBeNull();
		if (resolved === null) return;

		const enemy = ctx.getCombatant(resolved.targetId);
		if (enemy === undefined) throw new Error("test setup: enemy not found");
		takeDamage(enemy, resolved.amount);

		ctx.emit({
			type: "DAMAGE_DEALT",
			sourceId: resolved.sourceId,
			targetId: resolved.targetId,
			finalAmount: resolved.amount,
		});

		expect(resolved.amount).toBe(13); // 10 + 3 strength
		expect(dealtAmounts).toEqual([13]);
		expect(enemy.hp).toBe(20 - 13); // 7
	});

	it("cancelled DAMAGE_INTENDED means no hp loss and no DAMAGE_DEALT", () => {
		const ctx = makeCtx();
		let dealtFired = false;

		ctx.registerHandler({
			id: "shield",
			priority: 5,
			on: "DAMAGE_INTENDED",
			handle: () => null,
		});
		ctx.registerHandler({
			id: "dealt-observer",
			priority: 10,
			on: "DAMAGE_DEALT",
			handle(e) {
				dealtFired = true;
				return e;
			},
		});

		const resolved = ctx.emit(damageIntended(10));
		if (resolved !== null) {
			// Only emit DAMAGE_DEALT if not cancelled
			ctx.emit({
				type: "DAMAGE_DEALT",
				sourceId: asEntityId("player"),
				targetId: asEntityId("enemy-1"),
				finalAmount: (resolved as DamageIntended).amount,
			});
		}

		expect(resolved).toBeNull();
		expect(dealtFired).toBe(false);
		expect(ctx.getCombatant(asEntityId("enemy-1"))?.hp).toBe(20); // untouched
	});
});
