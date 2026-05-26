import { asCardId } from "@core/combat/entity.ts";
import type { Rng } from "@core/rng/rng.ts";
import charmanderRaw from "@data/cards/charmander.json";
import treeckoRaw from "@data/cards/treecko.json";
import type { CardDefinition, CardInstance } from "./card-definition.ts";
import { parseCardDefinition } from "./card-schema.ts";

// ---------------------------------------------------------------------------
// Starter names
// ---------------------------------------------------------------------------

export type StarterName = "charmander" | "treecko";

// ---------------------------------------------------------------------------
// Starter deck compositions — definitionId + number of copies
// ---------------------------------------------------------------------------

const STARTER_COMPOSITIONS: Record<
	StarterName,
	ReadonlyArray<{ readonly definitionId: string; readonly count: number }>
> = {
	charmander: [
		{ definitionId: "scratch", count: 5 },
		{ definitionId: "growl", count: 4 },
		{ definitionId: "ember", count: 1 },
	],
	treecko: [
		{ definitionId: "pound", count: 5 },
		{ definitionId: "harden", count: 4 },
		{ definitionId: "absorb", count: 1 },
	],
};

// ---------------------------------------------------------------------------
// Registry builder — validates each card at load time
// ---------------------------------------------------------------------------

function buildRegistry(sources: readonly unknown[][]): ReadonlyMap<string, CardDefinition> {
	const map = new Map<string, CardDefinition>();
	for (const source of sources) {
		for (let i = 0; i < source.length; i++) {
			const raw = source[i];
			let def: CardDefinition;
			try {
				def = parseCardDefinition(raw);
			} catch (err) {
				throw new Error(
					`Card registry: invalid card at index ${i}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
			if (map.has(def.id)) {
				throw new Error(`Card registry: duplicate card id "${def.id}"`);
			}
			map.set(def.id, def);
		}
	}
	return map;
}

// Eagerly validated at module load — crashes loudly on bad data
export const CARD_REGISTRY: ReadonlyMap<string, CardDefinition> = buildRegistry([
	charmanderRaw as unknown[],
	treeckoRaw as unknown[],
]);

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/** Returns the definition for `id`. Throws if not found. */
export function getCardDefinition(id: string): CardDefinition {
	const def = CARD_REGISTRY.get(id);
	if (def === undefined) throw new Error(`Card registry: unknown card id "${id}"`);
	return def;
}

// ---------------------------------------------------------------------------
// Starter deck factory
// ---------------------------------------------------------------------------

/**
 * Creates a shuffled starting deck of CardInstances for the given starter.
 * Instance IDs are deterministic: `<definitionId>-<n>` where n is the copy index.
 */
export function createStarterDeck(starter: StarterName, rng: Rng): CardInstance[] {
	const composition = STARTER_COMPOSITIONS[starter];
	const instances: CardInstance[] = [];
	let counter = 0;

	for (const { definitionId, count } of composition) {
		// Validate the definition exists at creation time
		getCardDefinition(definitionId);
		for (let i = 0; i < count; i++) {
			instances.push({
				instanceId: `${definitionId}-${counter++}`,
				definitionId: asCardId(definitionId),
				upgradeLevel: 0,
			});
		}
	}

	return rng.shuffle(instances);
}

// ---------------------------------------------------------------------------
// Pool queries
// ---------------------------------------------------------------------------

/** All card definitions for the given starter (tagged pool). */
export function getStarterPool(starter: StarterName): readonly CardDefinition[] {
	const tag = starter;
	return Array.from(CARD_REGISTRY.values()).filter((def) => def.tags?.includes(tag) === true);
}
