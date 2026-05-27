import type { StarterName } from "@core/cards/card-registry.ts";
import type { CombatState } from "@core/combat/effects/effect-handler.ts";
import { asCardId, asEntityId, createPlayer } from "@core/combat/entity.ts";
import { resetSpawnCounter, spawnEnemyById } from "@core/enemies/enemy-registry.ts";
import { Rng } from "@core/rng/rng.ts";
import type { PokemonType } from "@core/types/pokemon-types.ts";
import type { PlayerSnapshot } from "./types.ts";

// ---------------------------------------------------------------------------
// Starter metadata
// ---------------------------------------------------------------------------

const STARTER_META: Record<StarterName, { displayName: string; types: readonly PokemonType[] }> = {
	charmander: { displayName: "Charmander", types: ["fire"] },
	treecko: { displayName: "Treecko", types: ["grass"] },
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a CombatState from a PlayerSnapshot + starterId + enemyId + seed.
 * HP is preserved from the snapshot (not reset to max).
 */
export function createRunCombat(
	snapshot: PlayerSnapshot,
	starterId: StarterName,
	enemyId: string,
	seed: number,
): CombatState {
	const rng = new Rng(seed);
	const meta = STARTER_META[starterId];

	const player = createPlayer({
		id: asEntityId("player"),
		name: meta.displayName,
		types: meta.types,
		maxHp: snapshot.maxHp,
	});
	// Preserve run HP — createPlayer always sets hp = maxHp, so we patch it
	player.hp = snapshot.currentHp;

	const deck = snapshot.deckCardIds.map((defId, i) => ({
		instanceId: `${defId}-${i}`,
		definitionId: asCardId(defId),
		upgradeLevel: 0 as const,
	}));
	const drawPile = rng.shuffle([...deck]);

	resetSpawnCounter();
	const enemy = spawnEnemyById(enemyId, rng);

	return {
		player,
		enemies: [enemy],
		hand: [],
		drawPile,
		discardPile: [],
		exhaustPile: [],
	};
}
