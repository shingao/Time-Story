import { asEnemyId, asEntityId } from "@core/combat/entity.ts";
import { Rng } from "@core/rng/rng.ts";
import { beforeEach, describe, expect, it } from "vitest";
import {
	ENEMY_REGISTRY,
	getEnemyDefinition,
	resetSpawnCounter,
	spawnEnemy,
	spawnEnemyById,
} from "./enemy-registry.ts";

const rng = new Rng(1);

beforeEach(() => {
	resetSpawnCounter();
});

// ---------------------------------------------------------------------------
// Registry integrity
// ---------------------------------------------------------------------------

describe("ENEMY_REGISTRY", () => {
	it("contains all five Act-1 enemies", () => {
		const ids = ["pidgey", "caterpie", "zubat", "mankey", "beedrill-elite"];
		for (const id of ids) {
			expect(ENEMY_REGISTRY.has(asEnemyId(id))).toBe(true);
		}
	});

	it("has exactly 5 entries", () => {
		expect(ENEMY_REGISTRY.size).toBe(5);
	});

	it("every entry has a valid tier", () => {
		for (const def of ENEMY_REGISTRY.values()) {
			expect(["normal", "elite", "boss"]).toContain(def.tier);
		}
	});

	it("beedrill-elite has tier=elite", () => {
		const def = getEnemyDefinition(asEnemyId("beedrill-elite"));
		expect(def.tier).toBe("elite");
	});

	it("every entry has at least one intent pattern", () => {
		for (const def of ENEMY_REGISTRY.values()) {
			expect(def.intents.length).toBeGreaterThan(0);
		}
	});
});

// ---------------------------------------------------------------------------
// getEnemyDefinition
// ---------------------------------------------------------------------------

describe("getEnemyDefinition", () => {
	it("returns definition for a known id", () => {
		const def = getEnemyDefinition(asEnemyId("pidgey"));
		expect(def.name).toBe("Pidgey");
	});

	it("throws for an unknown id", () => {
		expect(() => getEnemyDefinition(asEnemyId("haunter"))).toThrow(/unknown enemy id/);
	});
});

// ---------------------------------------------------------------------------
// spawnEnemy
// ---------------------------------------------------------------------------

describe("spawnEnemy", () => {
	it("spawns an enemy with hp within the defined range", () => {
		const def = getEnemyDefinition(asEnemyId("pidgey"));
		const enemy = spawnEnemy(def, new Rng(99));
		expect(enemy.hp).toBeGreaterThanOrEqual(def.hp.min);
		expect(enemy.hp).toBeLessThanOrEqual(def.hp.max);
	});

	it("enemy starts with intent=unknown", () => {
		const def = getEnemyDefinition(asEnemyId("caterpie"));
		const enemy = spawnEnemy(def, rng);
		expect(enemy.intent.kind).toBe("unknown");
	});

	it("enemy aiState is initialised with empty cooldowns", () => {
		const def = getEnemyDefinition(asEnemyId("zubat"));
		const enemy = spawnEnemy(def, rng);
		expect(enemy.aiState.lastIntentKind).toBeNull();
		expect(enemy.aiState.repeatCount).toBe(0);
		expect(Object.keys(enemy.aiState.cooldowns)).toHaveLength(0);
	});

	it("uses sequential id by default: enemy-0, enemy-1, ...", () => {
		const def = getEnemyDefinition(asEnemyId("pidgey"));
		const e0 = spawnEnemy(def, rng);
		const e1 = spawnEnemy(def, rng);
		expect(String(e0.id)).toBe("enemy-0");
		expect(String(e1.id)).toBe("enemy-1");
	});

	it("respects provided entityId", () => {
		const def = getEnemyDefinition(asEnemyId("mankey"));
		const enemy = spawnEnemy(def, rng, asEntityId("boss-mankey"));
		expect(String(enemy.id)).toBe("boss-mankey");
	});

	it("sets definitionId on spawned enemy", () => {
		const def = getEnemyDefinition(asEnemyId("mankey"));
		const enemy = spawnEnemy(def, rng);
		expect(String(enemy.definitionId)).toBe("mankey");
	});
});

// ---------------------------------------------------------------------------
// spawnEnemyById
// ---------------------------------------------------------------------------

describe("spawnEnemyById", () => {
	it("spawns an enemy by string id", () => {
		const enemy = spawnEnemyById("pidgey", rng);
		expect(enemy.name).toBe("Pidgey");
	});

	it("throws for unknown id", () => {
		expect(() => spawnEnemyById("unknown-mon", rng)).toThrow();
	});
});

// ---------------------------------------------------------------------------
// resetSpawnCounter
// ---------------------------------------------------------------------------

describe("resetSpawnCounter", () => {
	it("restarts id counter at 0", () => {
		const def = getEnemyDefinition(asEnemyId("pidgey"));
		spawnEnemy(def, rng); // enemy-0
		spawnEnemy(def, rng); // enemy-1
		resetSpawnCounter();
		const fresh = spawnEnemy(def, rng);
		expect(String(fresh.id)).toBe("enemy-0");
	});
});
