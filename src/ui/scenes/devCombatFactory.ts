import type { StarterName } from "@core/cards/card-registry.ts";
import { createStarterDeck } from "@core/cards/card-registry.ts";
import type { CombatState } from "@core/combat/effects/effect-handler.ts";
import type { EnemyId } from "@core/combat/entity.ts";
import { asEntityId, createPlayer } from "@core/combat/entity.ts";
import { spawnEnemyById } from "@core/enemies/enemy-registry.ts";
import { Rng } from "@core/rng/rng.ts";
import type { PokemonType } from "@core/types/pokemon-types.ts";

const STARTER_META: Record<
	StarterName,
	{ displayName: string; types: PokemonType[]; maxHp: number }
> = {
	charmander: { displayName: "Charmander", types: ["fire"], maxHp: 44 },
	treecko: { displayName: "Treecko", types: ["grass"], maxHp: 40 },
};

/** Builds a full CombatState for a dev-menu encounter. Seed is randomised per call. */
export function createDevCombat(starter: StarterName, enemyId: EnemyId): CombatState {
	const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
	const rng = new Rng(seed);

	const meta = STARTER_META[starter];
	const player = createPlayer({
		id: asEntityId("player"),
		name: meta.displayName,
		types: meta.types,
		maxHp: meta.maxHp,
	});

	const drawPile = createStarterDeck(starter, rng);
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
