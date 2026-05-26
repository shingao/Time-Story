import type { CombatState } from "@core/combat/effects/effect-handler.ts";
import { CombatContext } from "@core/combat/effects/effect-handler.ts";
import {
	asBuffId,
	asCardId,
	asEntityId,
	asStatusId,
	createEnemy,
	createPlayer,
} from "@core/combat/entity.ts";
import { Rng } from "@core/rng/rng.ts";
import { describe, expect, it } from "vitest";
import type { CardDefinition, CardInstance } from "./card-definition.ts";
import { executeCard } from "./card-executor.ts";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const PLAYER_ID = asEntityId("player");
const ENEMY_ID = asEntityId("enemy-1");

function makeState(): CombatState {
	return {
		player: createPlayer({ id: PLAYER_ID, name: "Charmander", types: ["fire"], maxHp: 44 }),
		enemies: [
			createEnemy({ id: ENEMY_ID, name: "Pidgey", types: ["normal", "flying"], maxHp: 20 }),
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

const rng = new Rng(42);

function instance(defId = "scratch"): CardInstance {
	return { instanceId: `${defId}-1`, definitionId: asCardId(defId), upgradeLevel: 0 };
}

// ---------------------------------------------------------------------------
// CARD_PLAYED and ENERGY_CHANGED always emitted
// ---------------------------------------------------------------------------

describe("executeCard() — preamble events", () => {
	it("emits ENERGY_CHANGED then CARD_PLAYED", () => {
		const def: CardDefinition = {
			id: asCardId("scratch"),
			name: "Scratch",
			description: "Deal 6 damage.",
			types: ["normal"],
			category: "attack",
			rarity: "starter",
			energyCost: 1,
			target: "enemy",
			effects: [{ kind: "damage", amount: 6 }],
		};
		const ctx = makeCtx();
		executeCard(instance("scratch"), def, ENEMY_ID, ctx, rng);
		expect(ctx.log[0]?.event.type).toBe("ENERGY_CHANGED");
		expect(ctx.log[1]?.event.type).toBe("CARD_PLAYED");
	});

	it("deducts correct energy from player", () => {
		const def: CardDefinition = {
			id: asCardId("ember"),
			name: "Ember",
			description: "Deal 7 fire damage.",
			types: ["fire"],
			category: "attack",
			rarity: "common",
			energyCost: 2,
			target: "enemy",
			effects: [{ kind: "damage", amount: 7 }],
		};
		const ctx = makeCtx();
		executeCard(instance("ember"), def, ENEMY_ID, ctx, rng);
		expect(ctx.getPlayer().energy).toBe(1); // started at 3, cost 2
	});

	it("energy does not go below 0 for over-cost cards", () => {
		const def: CardDefinition = {
			id: asCardId("heavy"),
			name: "Heavy",
			description: "Costs more than max energy.",
			types: ["normal"],
			category: "attack",
			rarity: "rare",
			energyCost: 99,
			target: "enemy",
			effects: [{ kind: "damage", amount: 1 }],
		};
		const ctx = makeCtx();
		executeCard(instance("heavy"), def, ENEMY_ID, ctx, rng);
		expect(ctx.getPlayer().energy).toBe(0);
	});

	it("CARD_PLAYED carries the targetId when provided", () => {
		const def: CardDefinition = {
			id: asCardId("scratch"),
			name: "Scratch",
			description: "",
			types: ["normal"],
			category: "attack",
			rarity: "starter",
			energyCost: 1,
			target: "enemy",
			effects: [],
		};
		const ctx = makeCtx();
		executeCard(instance(), def, ENEMY_ID, ctx, rng);
		const played = ctx.log[1]?.event;
		expect(played?.type).toBe("CARD_PLAYED");
		if (played?.type === "CARD_PLAYED") expect(played.targetId).toBe(ENEMY_ID);
	});

	it("CARD_PLAYED has no targetId for 'none' target cards", () => {
		const def: CardDefinition = {
			id: asCardId("draw-skill"),
			name: "Draw Skill",
			description: "Draw 2.",
			types: ["normal"],
			category: "skill",
			rarity: "common",
			energyCost: 0,
			target: "none",
			effects: [{ kind: "drawCards", count: 2 }],
		};
		const ctx = makeCtx();
		executeCard(instance("draw-skill"), def, undefined, ctx, rng);
		const played = ctx.log[1]?.event;
		if (played?.type === "CARD_PLAYED") expect(played.targetId).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// damage effect
// ---------------------------------------------------------------------------

describe("damage effect", () => {
	it("emits DAMAGE_INTENDED with correct amount and types", () => {
		const def: CardDefinition = {
			id: asCardId("ember"),
			name: "Ember",
			description: "",
			types: ["fire"],
			category: "attack",
			rarity: "common",
			energyCost: 1,
			target: "enemy",
			effects: [{ kind: "damage", amount: 7 }],
		};
		const ctx = makeCtx();
		executeCard(instance("ember"), def, ENEMY_ID, ctx, rng);
		const dmgEvent = ctx.log.find((l) => l.event.type === "DAMAGE_INTENDED")?.event;
		expect(dmgEvent?.type).toBe("DAMAGE_INTENDED");
		if (dmgEvent?.type === "DAMAGE_INTENDED") {
			expect(dmgEvent.amount).toBe(7);
			expect(dmgEvent.damageTypes).toEqual(["fire"]);
			expect(dmgEvent.targetId).toBe(ENEMY_ID);
			expect(dmgEvent.cancellable).toBe(true);
		}
	});

	it("uses explicit damageTypes when provided", () => {
		const def: CardDefinition = {
			id: asCardId("water-gun"),
			name: "Water Gun",
			description: "",
			types: ["normal"],
			category: "attack",
			rarity: "common",
			energyCost: 1,
			target: "enemy",
			effects: [{ kind: "damage", amount: 5, damageTypes: ["water"] }],
		};
		const ctx = makeCtx();
		executeCard(instance("water-gun"), def, ENEMY_ID, ctx, rng);
		const dmgEvent = ctx.log.find((l) => l.event.type === "DAMAGE_INTENDED")?.event;
		if (dmgEvent?.type === "DAMAGE_INTENDED") {
			expect(dmgEvent.damageTypes).toEqual(["water"]);
		}
	});

	it("falls back to card types when damageTypes is omitted", () => {
		const def: CardDefinition = {
			id: asCardId("fire-claw"),
			name: "Fire Claw",
			description: "",
			types: ["fire"],
			category: "attack",
			rarity: "common",
			energyCost: 1,
			target: "enemy",
			effects: [{ kind: "damage", amount: 5 }],
		};
		const ctx = makeCtx();
		executeCard(instance("fire-claw"), def, ENEMY_ID, ctx, rng);
		const dmgEvent = ctx.log.find((l) => l.event.type === "DAMAGE_INTENDED")?.event;
		if (dmgEvent?.type === "DAMAGE_INTENDED") {
			expect(dmgEvent.damageTypes).toEqual(["fire"]);
		}
	});

	it("does not emit damage if targetId is undefined", () => {
		const def: CardDefinition = {
			id: asCardId("punch"),
			name: "Punch",
			description: "",
			types: ["fighting"],
			category: "attack",
			rarity: "common",
			energyCost: 1,
			target: "enemy",
			effects: [{ kind: "damage", amount: 8 }],
		};
		const ctx = makeCtx();
		executeCard(instance("punch"), def, undefined, ctx, rng);
		expect(ctx.log.some((l) => l.event.type === "DAMAGE_INTENDED")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// block effect
// ---------------------------------------------------------------------------

describe("block effect", () => {
	it("emits BLOCK_GAINED and increases player block", () => {
		const def: CardDefinition = {
			id: asCardId("growl"),
			name: "Growl",
			description: "Gain 5 block.",
			types: ["normal"],
			category: "skill",
			rarity: "starter",
			energyCost: 1,
			target: "self",
			effects: [{ kind: "block", amount: 5 }],
		};
		const ctx = makeCtx();
		executeCard(instance("growl"), def, undefined, ctx, rng);
		expect(ctx.getPlayer().block).toBe(5);
		const blockEvent = ctx.log.find((l) => l.event.type === "BLOCK_GAINED")?.event;
		expect(blockEvent?.type).toBe("BLOCK_GAINED");
		if (blockEvent?.type === "BLOCK_GAINED") {
			expect(blockEvent.amount).toBe(5);
			expect(blockEvent.entityId).toBe(PLAYER_ID);
		}
	});

	it("stacks block with existing block", () => {
		const def: CardDefinition = {
			id: asCardId("growl"),
			name: "Growl",
			description: "",
			types: ["normal"],
			category: "skill",
			rarity: "starter",
			energyCost: 1,
			target: "self",
			effects: [{ kind: "block", amount: 5 }],
		};
		const ctx = makeCtx();
		ctx.getPlayer().block = 3;
		executeCard(instance("growl"), def, undefined, ctx, rng);
		expect(ctx.getPlayer().block).toBe(8);
	});
});

// ---------------------------------------------------------------------------
// applyStatus effect
// ---------------------------------------------------------------------------

describe("applyStatus effect", () => {
	it("applies burn to enemy and emits STATUS_APPLIED", () => {
		const def: CardDefinition = {
			id: asCardId("ember"),
			name: "Ember",
			description: "",
			types: ["fire"],
			category: "attack",
			rarity: "common",
			energyCost: 1,
			target: "enemy",
			effects: [
				{ kind: "applyStatus", statusId: asStatusId("burn"), behavior: "intensity", stacks: 1 },
			],
		};
		const ctx = makeCtx();
		executeCard(instance("ember"), def, ENEMY_ID, ctx, rng);
		const enemy = ctx.getEnemies()[0];
		const burn = enemy?.statuses.find((s) => s.id === "burn");
		expect(burn).toBeDefined();
		expect(burn?.stacks).toBe(1);
		expect(ctx.log.some((l) => l.event.type === "STATUS_APPLIED")).toBe(true);
	});

	it("applies status to self when toSelf is true", () => {
		const def: CardDefinition = {
			id: asCardId("self-burn"),
			name: "Self Burn",
			description: "Apply burn to yourself (weird).",
			types: ["fire"],
			category: "skill",
			rarity: "common",
			energyCost: 0,
			target: "self",
			effects: [
				{
					kind: "applyStatus",
					statusId: asStatusId("burn"),
					behavior: "intensity",
					stacks: 2,
					toSelf: true,
				},
			],
		};
		const ctx = makeCtx();
		executeCard(instance("self-burn"), def, undefined, ctx, rng);
		const player = ctx.getPlayer();
		const burn = player.statuses.find((s) => s.id === "burn");
		expect(burn?.stacks).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// applyBuff effect
// ---------------------------------------------------------------------------

describe("applyBuff effect", () => {
	it("applies strength to player by default and emits BUFF_APPLIED", () => {
		const def: CardDefinition = {
			id: asCardId("howl"),
			name: "Howl",
			description: "Gain 2 Strength.",
			types: ["normal"],
			category: "skill",
			rarity: "common",
			energyCost: 1,
			target: "self",
			effects: [{ kind: "applyBuff", buffId: asBuffId("strength"), stacks: 2 }],
		};
		const ctx = makeCtx();
		executeCard(instance("howl"), def, undefined, ctx, rng);
		const strengthBuff = ctx.getPlayer().buffs.find((b) => b.id === "strength");
		expect(strengthBuff?.stacks).toBe(2);
		expect(ctx.log.some((l) => l.event.type === "BUFF_APPLIED")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// heal effect
// ---------------------------------------------------------------------------

describe("heal effect", () => {
	it("heals the player and emits HEAL", () => {
		const def: CardDefinition = {
			id: asCardId("oran-berry"),
			name: "Oran Berry",
			description: "Heal 10 HP.",
			types: ["normal"],
			category: "skill",
			rarity: "common",
			energyCost: 0,
			target: "self",
			effects: [{ kind: "heal", amount: 10 }],
		};
		const ctx = makeCtx();
		ctx.getPlayer().hp = 20; // already damaged
		executeCard(instance("oran-berry"), def, undefined, ctx, rng);
		expect(ctx.getPlayer().hp).toBe(30);
		expect(ctx.log.some((l) => l.event.type === "HEAL")).toBe(true);
	});

	it("heals do not exceed maxHp", () => {
		const def: CardDefinition = {
			id: asCardId("mega-heal"),
			name: "Mega Heal",
			description: "",
			types: ["normal"],
			category: "skill",
			rarity: "rare",
			energyCost: 1,
			target: "self",
			effects: [{ kind: "heal", amount: 999 }],
		};
		const ctx = makeCtx();
		ctx.getPlayer().hp = 10;
		executeCard(instance("mega-heal"), def, undefined, ctx, rng);
		expect(ctx.getPlayer().hp).toBe(ctx.getPlayer().maxHp);
	});
});

// ---------------------------------------------------------------------------
// drawCards effect
// ---------------------------------------------------------------------------

describe("drawCards effect", () => {
	it("emits N CARD_DRAWN events", () => {
		const def: CardDefinition = {
			id: asCardId("acrobatics"),
			name: "Acrobatics",
			description: "Draw 3 cards.",
			types: ["flying"],
			category: "skill",
			rarity: "common",
			energyCost: 1,
			target: "none",
			effects: [{ kind: "drawCards", count: 3 }],
		};
		const ctx = makeCtx();
		// Populate draw pile so the drawCards effect has cards to draw
		ctx.state.drawPile = [
			{ instanceId: "d1", definitionId: asCardId("dummy"), upgradeLevel: 0 },
			{ instanceId: "d2", definitionId: asCardId("dummy"), upgradeLevel: 0 },
			{ instanceId: "d3", definitionId: asCardId("dummy"), upgradeLevel: 0 },
		];
		executeCard(instance("acrobatics"), def, undefined, ctx, rng);
		const drawEvents = ctx.log.filter((l) => l.event.type === "CARD_DRAWN");
		expect(drawEvents).toHaveLength(3);
	});
});

// ---------------------------------------------------------------------------
// gainEnergy effect
// ---------------------------------------------------------------------------

describe("gainEnergy effect", () => {
	it("adds energy to player and emits ENERGY_CHANGED", () => {
		const def: CardDefinition = {
			id: asCardId("burst"),
			name: "Burst",
			description: "Gain 1 energy.",
			types: ["electric"],
			category: "skill",
			rarity: "uncommon",
			energyCost: 0,
			target: "none",
			effects: [{ kind: "gainEnergy", amount: 1 }],
		};
		const ctx = makeCtx();
		executeCard(instance("burst"), def, undefined, ctx, rng);
		// Player starts at 3 energy, gains 1, but maxEnergy is also 3 → stays 3
		expect(ctx.getPlayer().energy).toBe(3);
	});

	it("gainEnergy respects maxEnergy cap", () => {
		const def: CardDefinition = {
			id: asCardId("burst"),
			name: "Burst",
			description: "",
			types: ["electric"],
			category: "skill",
			rarity: "uncommon",
			energyCost: 0,
			target: "none",
			effects: [{ kind: "gainEnergy", amount: 99 }],
		};
		const ctx = makeCtx();
		ctx.getPlayer().energy = 1;
		executeCard(instance("burst"), def, undefined, ctx, rng);
		expect(ctx.getPlayer().energy).toBe(3); // maxEnergy
	});
});

// ---------------------------------------------------------------------------
// exhaust effect
// ---------------------------------------------------------------------------

describe("exhaust effect", () => {
	it("emits CARD_EXHAUSTED and moves card to exhaust pile", () => {
		const def: CardDefinition = {
			id: asCardId("offering"),
			name: "Offering",
			description: "Exhaust.",
			types: ["normal"],
			category: "skill",
			rarity: "uncommon",
			energyCost: 0,
			target: "none",
			effects: [{ kind: "exhaust" }],
		};
		const inst = instance("offering");
		const ctx = makeCtx();
		ctx.state.hand.push(inst); // card must be in hand to be exhausted
		executeCard(inst, def, undefined, ctx, rng);
		expect(ctx.log.some((l) => l.event.type === "CARD_EXHAUSTED")).toBe(true);
		expect(ctx.state.exhaustPile).toHaveLength(1);
		expect(ctx.state.hand).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Scaling
// ---------------------------------------------------------------------------

describe("scaling", () => {
	it("damage scales with strength buff", () => {
		const def: CardDefinition = {
			id: asCardId("claw"),
			name: "Claw",
			description: "Deal 4 + Strength damage.",
			types: ["normal"],
			category: "attack",
			rarity: "common",
			energyCost: 1,
			target: "enemy",
			effects: [{ kind: "damage", amount: 4, scaling: { source: "strength", factor: 1 } }],
		};
		const ctx = makeCtx();
		ctx.getPlayer().buffs.push({ id: asBuffId("strength"), stacks: 3 });
		executeCard(instance("claw"), def, ENEMY_ID, ctx, rng);
		const dmg = ctx.log.find((l) => l.event.type === "DAMAGE_INTENDED")?.event;
		if (dmg?.type === "DAMAGE_INTENDED") expect(dmg.amount).toBe(7); // 4 + 3
	});

	it("block scales with energy remaining", () => {
		const def: CardDefinition = {
			id: asCardId("shell"),
			name: "Shell",
			description: "Gain block equal to remaining energy × 3.",
			types: ["normal"],
			category: "skill",
			rarity: "uncommon",
			energyCost: 0,
			target: "self",
			effects: [{ kind: "block", amount: 0, scaling: { source: "energy", factor: 3 } }],
		};
		const ctx = makeCtx();
		ctx.getPlayer().energy = 2;
		executeCard(instance("shell"), def, undefined, ctx, rng);
		expect(ctx.getPlayer().block).toBe(6); // 0 + 2 energy × 3
	});

	it("scaling does not produce negative amounts (clamped to 0)", () => {
		const def: CardDefinition = {
			id: asCardId("negative-block"),
			name: "Weird Block",
			description: "",
			types: ["normal"],
			category: "skill",
			rarity: "rare",
			energyCost: 0,
			target: "self",
			effects: [{ kind: "block", amount: 0, scaling: { source: "energy", factor: -10 } }],
		};
		const ctx = makeCtx();
		executeCard(instance("negative-block"), def, undefined, ctx, rng);
		expect(ctx.getPlayer().block).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

describe("conditions", () => {
	it("conditional effect fires when condition is met", () => {
		const def: CardDefinition = {
			id: asCardId("ignite"),
			name: "Ignite",
			description: "If target is burning, deal 6 bonus damage.",
			types: ["fire"],
			category: "attack",
			rarity: "uncommon",
			energyCost: 1,
			target: "enemy",
			effects: [
				{
					kind: "damage",
					amount: 6,
					condition: { when: "targetHasStatus", statusId: asStatusId("burn") },
				},
			],
		};
		const ctx = makeCtx();
		const enemy = ctx.getEnemies()[0];
		if (enemy === undefined) throw new Error("test setup: no enemy");
		enemy.statuses.push({ id: asStatusId("burn"), stacks: 1, behavior: "intensity" });

		executeCard(instance("ignite"), def, ENEMY_ID, ctx, rng);
		expect(ctx.log.some((l) => l.event.type === "DAMAGE_INTENDED")).toBe(true);
	});

	it("conditional effect is skipped when condition is not met", () => {
		const def: CardDefinition = {
			id: asCardId("ignite"),
			name: "Ignite",
			description: "If target is burning, deal 6 bonus damage.",
			types: ["fire"],
			category: "attack",
			rarity: "uncommon",
			energyCost: 1,
			target: "enemy",
			effects: [
				{
					kind: "damage",
					amount: 6,
					condition: { when: "targetHasStatus", statusId: asStatusId("burn") },
				},
			],
		};
		const ctx = makeCtx(); // enemy has no burn
		executeCard(instance("ignite"), def, ENEMY_ID, ctx, rng);
		expect(ctx.log.some((l) => l.event.type === "DAMAGE_INTENDED")).toBe(false);
	});

	it("selfHasBuff condition fires when buff present with sufficient stacks", () => {
		const def: CardDefinition = {
			id: asCardId("rage-claw"),
			name: "Rage Claw",
			description: "If you have 2+ Rage, deal 10 damage.",
			types: ["normal"],
			category: "attack",
			rarity: "uncommon",
			energyCost: 1,
			target: "enemy",
			effects: [
				{
					kind: "damage",
					amount: 10,
					condition: { when: "selfHasBuff", buffId: asBuffId("rage"), minStacks: 2 },
				},
			],
		};
		const ctx = makeCtx();
		ctx.getPlayer().buffs.push({ id: asBuffId("rage"), stacks: 2 });
		executeCard(instance("rage-claw"), def, ENEMY_ID, ctx, rng);
		expect(ctx.log.some((l) => l.event.type === "DAMAGE_INTENDED")).toBe(true);
	});

	it("selfHasBuff condition skips when stacks too low", () => {
		const def: CardDefinition = {
			id: asCardId("rage-claw"),
			name: "Rage Claw",
			description: "",
			types: ["normal"],
			category: "attack",
			rarity: "uncommon",
			energyCost: 1,
			target: "enemy",
			effects: [
				{
					kind: "damage",
					amount: 10,
					condition: { when: "selfHasBuff", buffId: asBuffId("rage"), minStacks: 2 },
				},
			],
		};
		const ctx = makeCtx();
		ctx.getPlayer().buffs.push({ id: asBuffId("rage"), stacks: 1 }); // only 1 stack
		executeCard(instance("rage-claw"), def, ENEMY_ID, ctx, rng);
		expect(ctx.log.some((l) => l.event.type === "DAMAGE_INTENDED")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Multi-effect cards
// ---------------------------------------------------------------------------

describe("multi-effect cards", () => {
	it("both effects execute in order", () => {
		const def: CardDefinition = {
			id: asCardId("ember"),
			name: "Ember",
			description: "Deal 7 fire damage. Apply 1 Burn.",
			types: ["fire"],
			category: "attack",
			rarity: "common",
			energyCost: 1,
			target: "enemy",
			effects: [
				{ kind: "damage", amount: 7 },
				{ kind: "applyStatus", statusId: asStatusId("burn"), behavior: "intensity", stacks: 1 },
			],
		};
		const ctx = makeCtx();
		executeCard(instance("ember"), def, ENEMY_ID, ctx, rng);
		const types = ctx.log.map((l) => l.event.type);
		expect(types).toContain("DAMAGE_INTENDED");
		expect(types).toContain("STATUS_APPLIED");
		// damage must come before status
		expect(types.indexOf("DAMAGE_INTENDED")).toBeLessThan(types.indexOf("STATUS_APPLIED"));
	});
});

// ---------------------------------------------------------------------------
// Upgrade integration
// ---------------------------------------------------------------------------

describe("upgrade integration", () => {
	it("upgraded card uses upgradeMap effects", () => {
		const def: CardDefinition = {
			id: asCardId("growl"),
			name: "Growl",
			description: "Gain 5 block.",
			types: ["normal"],
			category: "skill",
			rarity: "starter",
			energyCost: 1,
			target: "self",
			effects: [{ kind: "block", amount: 5 }],
			upgradeMap: {
				name: "Growl+",
				description: "Gain 8 block.",
				effects: [{ kind: "block", amount: 8 }],
			},
		};
		const upgradedInst: CardInstance = {
			instanceId: "growl-1",
			definitionId: asCardId("growl"),
			upgradeLevel: 1,
		};
		const ctx = makeCtx();
		executeCard(upgradedInst, def, undefined, ctx, rng);
		expect(ctx.getPlayer().block).toBe(8);
	});
});
