import type { Enemy, EnemyId, EntityId } from "@core/combat/entity.ts";
import { asEnemyId, asEntityId, createEnemy } from "@core/combat/entity.ts";
import type { Rng } from "@core/rng/rng.ts";
import beedrillRaw from "@data/enemies/beedrill-elite.json";
import caterpieRaw from "@data/enemies/caterpie.json";
import mankeyRaw from "@data/enemies/mankey.json";
import pidgeyRaw from "@data/enemies/pidgey.json";
import zubatRaw from "@data/enemies/zubat.json";
import { parseEnemyDefinition } from "./enemy-schema.ts";
import type { EnemyDefinition } from "./enemy-types.ts";

// ---------------------------------------------------------------------------
// Registry builder — validates each definition at module load
// ---------------------------------------------------------------------------

function buildRegistry(sources: readonly unknown[]): ReadonlyMap<EnemyId, EnemyDefinition> {
	const map = new Map<EnemyId, EnemyDefinition>();
	for (let i = 0; i < sources.length; i++) {
		const raw = sources[i];
		let def: EnemyDefinition;
		try {
			def = parseEnemyDefinition(raw);
		} catch (err) {
			throw new Error(
				`Enemy registry: invalid definition at index ${i}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
		if (map.has(def.id)) {
			throw new Error(`Enemy registry: duplicate enemy id "${String(def.id)}"`);
		}
		map.set(def.id, def);
	}
	return map;
}

// Eagerly validated at module load — crashes loudly on bad data
export const ENEMY_REGISTRY: ReadonlyMap<EnemyId, EnemyDefinition> = buildRegistry([
	pidgeyRaw,
	caterpieRaw,
	zubatRaw,
	mankeyRaw,
	beedrillRaw,
]);

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/** Returns the EnemyDefinition for `id`. Throws if not found. */
export function getEnemyDefinition(id: EnemyId): EnemyDefinition {
	const def = ENEMY_REGISTRY.get(id);
	if (def === undefined) throw new Error(`Enemy registry: unknown enemy id "${String(id)}"`);
	return def;
}

// ---------------------------------------------------------------------------
// Spawning — creates a runtime Enemy entity from a definition
// ---------------------------------------------------------------------------

let _spawnCounter = 0;

/** Resets the spawn counter (call in test beforeEach to get predictable IDs). */
export function resetSpawnCounter(): void {
	_spawnCounter = 0;
}

/**
 * Creates a runtime Enemy from a definition.
 * HP is randomised within [def.hp.min, def.hp.max] using `rng`.
 * `entityId` defaults to a sequential "enemy-N" if not provided.
 */
export function spawnEnemy(def: EnemyDefinition, rng: Rng, entityId?: EntityId): Enemy {
	const hp = rng.nextInt(def.hp.min, def.hp.max);
	const id = entityId ?? asEntityId(`enemy-${_spawnCounter++}`);
	return createEnemy({
		id,
		name: def.name,
		types: def.types,
		maxHp: hp,
		definitionId: def.id,
	});
}

/** Convenience: spawn by string id. */
export function spawnEnemyById(id: string, rng: Rng, entityId?: EntityId): Enemy {
	return spawnEnemy(getEnemyDefinition(asEnemyId(id)), rng, entityId);
}
