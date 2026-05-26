import { describe, expect, it } from "vitest";
import type { CombatState } from "./effects/effect-handler.ts";
import { CombatContext } from "./effects/effect-handler.ts";
import {
	applyBuff,
	applyStatus,
	asBuffId,
	asEntityId,
	asStatusId,
	createPlayer,
	findBuff,
	findStatus,
	gainBlock,
} from "./entity.ts";
import { tickBuffs, tickStatuses } from "./status-ticks.ts";
import { registerDefaultHandlers } from "./turn-engine.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeState(): CombatState {
	return {
		player: createPlayer({
			id: asEntityId("player"),
			name: "Charmander",
			types: ["fire"],
			maxHp: 44,
		}),
		enemies: [],
		hand: [],
		drawPile: [],
		discardPile: [],
		exhaustPile: [],
	};
}

function makeCtx(): CombatContext {
	const ctx = new CombatContext(makeState());
	registerDefaultHandlers(ctx);
	return ctx;
}

// ---------------------------------------------------------------------------
// tickStatuses — Burn (intensity)
// ---------------------------------------------------------------------------

describe("tickStatuses — Burn (intensity)", () => {
	it("emits DAMAGE_INTENDED with damageSource=status", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyStatus(player, { id: asStatusId("burn"), stacks: 3, behavior: "intensity" });

		tickStatuses(player, ctx);

		const ev = ctx.log.find((l) => l.event.type === "DAMAGE_INTENDED")?.event;
		expect(ev?.type).toBe("DAMAGE_INTENDED");
		if (ev?.type === "DAMAGE_INTENDED") {
			expect(ev.damageSource).toBe("status");
			expect(ev.amount).toBe(3);
			expect(ev.damageTypes).toEqual(["fire"]);
		}
	});

	it("deals stacks HP damage (no block)", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyStatus(player, { id: asStatusId("burn"), stacks: 3, behavior: "intensity" });

		const hpBefore = player.hp;
		tickStatuses(player, ctx);

		expect(player.hp).toBe(hpBefore - 3);
	});

	it("decays by 1 after tick: 3 → 2", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyStatus(player, { id: asStatusId("burn"), stacks: 3, behavior: "intensity" });

		tickStatuses(player, ctx);

		expect(findStatus(player, asStatusId("burn"))?.stacks).toBe(2);
	});

	it("removes Burn when stacks reach 0", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyStatus(player, { id: asStatusId("burn"), stacks: 1, behavior: "intensity" });

		tickStatuses(player, ctx);

		expect(findStatus(player, asStatusId("burn"))).toBeUndefined();
	});

	it("emits STATUS_TICKED with remainingStacks after decay", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyStatus(player, { id: asStatusId("burn"), stacks: 2, behavior: "intensity" });

		tickStatuses(player, ctx);

		const ev = ctx.log.find((l) => l.event.type === "STATUS_TICKED")?.event;
		expect(ev?.type).toBe("STATUS_TICKED");
		if (ev?.type === "STATUS_TICKED") {
			expect(ev.remainingStacks).toBe(1);
		}
	});

	it("block absorbs burn damage before HP", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		gainBlock(player, 5);
		applyStatus(player, { id: asStatusId("burn"), stacks: 3, behavior: "intensity" });

		const hpBefore = player.hp;
		tickStatuses(player, ctx);

		// 3 damage, 5 block → block absorbs all → HP unchanged
		expect(player.hp).toBe(hpBefore);
		expect(player.block).toBe(2);
	});

	it("three consecutive ticks: 3 → 2 → 1 → gone", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyStatus(player, { id: asStatusId("burn"), stacks: 3, behavior: "intensity" });

		tickStatuses(player, ctx); // 3 damage, stacks→2
		tickStatuses(player, ctx); // 2 damage, stacks→1
		tickStatuses(player, ctx); // 1 damage, stacks→0, removed

		expect(findStatus(player, asStatusId("burn"))).toBeUndefined();
		// Total damage: 3+2+1 = 6
		expect(player.hp).toBe(44 - 6);
	});
});

// ---------------------------------------------------------------------------
// tickStatuses — Poison (intensity)
// ---------------------------------------------------------------------------

describe("tickStatuses — Poison (intensity)", () => {
	it("emits DAMAGE_INTENDED with damageTypes=[poison]", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyStatus(player, { id: asStatusId("poison"), stacks: 2, behavior: "intensity" });

		tickStatuses(player, ctx);

		const ev = ctx.log.find((l) => l.event.type === "DAMAGE_INTENDED")?.event;
		if (ev?.type === "DAMAGE_INTENDED") {
			expect(ev.damageTypes).toEqual(["poison"]);
		}
	});
});

// ---------------------------------------------------------------------------
// tickStatuses — duration status (no damage tick)
// ---------------------------------------------------------------------------

describe("tickStatuses — duration status", () => {
	it("decrements stacks without dealing damage", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyStatus(player, { id: asStatusId("paralyze"), stacks: 3, behavior: "duration" });

		const hpBefore = player.hp;
		tickStatuses(player, ctx);

		expect(player.hp).toBe(hpBefore); // no HP loss
		expect(findStatus(player, asStatusId("paralyze"))?.stacks).toBe(2);
	});

	it("removes duration status at 0 stacks", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyStatus(player, { id: asStatusId("paralyze"), stacks: 1, behavior: "duration" });

		tickStatuses(player, ctx);

		expect(findStatus(player, asStatusId("paralyze"))).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// tickStatuses — doubt (intensity, no damage)
// ---------------------------------------------------------------------------

describe("tickStatuses — doubt (intensity, no damage tick)", () => {
	it("decrements stacks without dealing damage", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyStatus(player, { id: asStatusId("doubt"), stacks: 2, behavior: "intensity" });

		const hpBefore = player.hp;
		tickStatuses(player, ctx);

		expect(player.hp).toBe(hpBefore);
		expect(findStatus(player, asStatusId("doubt"))?.stacks).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// tickStatuses — multiple statuses in one tick
// ---------------------------------------------------------------------------

describe("tickStatuses — multiple statuses", () => {
	it("ticks all statuses in one call", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyStatus(player, { id: asStatusId("burn"), stacks: 2, behavior: "intensity" });
		applyStatus(player, { id: asStatusId("poison"), stacks: 1, behavior: "intensity" });

		const hpBefore = player.hp;
		tickStatuses(player, ctx);

		// Both deal damage: 2 (burn) + 1 (poison) = 3
		expect(player.hp).toBe(hpBefore - 3);
		expect(findStatus(player, asStatusId("burn"))?.stacks).toBe(1);
		expect(findStatus(player, asStatusId("poison"))).toBeUndefined(); // removed
	});
});

// ---------------------------------------------------------------------------
// tickBuffs — duration-limited buffs
// ---------------------------------------------------------------------------

describe("tickBuffs — duration limited", () => {
	it("decrements duration each tick", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyBuff(player, { id: asBuffId("strength"), stacks: 2, duration: 3 });

		tickBuffs(player, ctx);

		expect(findBuff(player, asBuffId("strength"))?.duration).toBe(2);
	});

	it("removes buff when duration reaches 0 and emits BUFF_EXPIRED", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyBuff(player, { id: asBuffId("strength"), stacks: 2, duration: 1 });

		tickBuffs(player, ctx);

		expect(findBuff(player, asBuffId("strength"))).toBeUndefined();
		const ev = ctx.log.find((l) => l.event.type === "BUFF_EXPIRED")?.event;
		expect(ev?.type).toBe("BUFF_EXPIRED");
		if (ev?.type === "BUFF_EXPIRED") {
			expect(String(ev.buffId)).toBe("strength");
		}
	});
});

// ---------------------------------------------------------------------------
// tickBuffs — permanent buffs (no duration)
// ---------------------------------------------------------------------------

describe("tickBuffs — permanent buffs", () => {
	it("never decrements a permanent buff (duration=undefined)", () => {
		const ctx = makeCtx();
		const player = ctx.state.player;
		applyBuff(player, { id: asBuffId("strength"), stacks: 5 }); // no duration

		tickBuffs(player, ctx);
		tickBuffs(player, ctx);
		tickBuffs(player, ctx);

		expect(findBuff(player, asBuffId("strength"))?.stacks).toBe(5);
		expect(findBuff(player, asBuffId("strength"))?.duration).toBeUndefined();
	});
});
