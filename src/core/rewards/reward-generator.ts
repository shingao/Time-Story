import type { CardRarity } from "@core/cards/card-definition.ts";
import type { StarterName } from "@core/cards/card-registry.ts";
import { getStarterPool } from "@core/cards/card-registry.ts";
import type { Rng } from "@core/rng/rng.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CombatTier = "normal" | "elite" | "boss";

export interface RewardData {
	readonly gold: number;
	readonly cardChoices: readonly string[];
	readonly tier: CombatTier;
	readonly relicChoice: null; // reserved for Phase 5.1
}

// ---------------------------------------------------------------------------
// Tier configuration
// ---------------------------------------------------------------------------

interface TierConfig {
	readonly goldMin: number;
	readonly goldMax: number;
	readonly rarityWeights: Readonly<Record<CardRarity, number>>;
}

const TIER_CONFIG: Record<CombatTier, TierConfig> = {
	normal: {
		goldMin: 10,
		goldMax: 20,
		rarityWeights: { starter: 0, common: 70, uncommon: 25, rare: 5 },
	},
	elite: {
		goldMin: 25,
		goldMax: 40,
		rarityWeights: { starter: 0, common: 40, uncommon: 45, rare: 15 },
	},
	boss: {
		goldMin: 50,
		goldMax: 80,
		rarityWeights: { starter: 0, common: 20, uncommon: 50, rare: 30 },
	},
};

const MAX_CHOICES = 3;

// ---------------------------------------------------------------------------
// Gold
// ---------------------------------------------------------------------------

export function generateRewardGold(tier: CombatTier, rng: Rng): number {
	const { goldMin, goldMax } = TIER_CONFIG[tier];
	return rng.nextInt(goldMin, goldMax);
}

// ---------------------------------------------------------------------------
// Card reward — weighted sampling without replacement
// ---------------------------------------------------------------------------

export function generateCardReward(starterId: StarterName, tier: CombatTier, rng: Rng): string[] {
	const { rarityWeights } = TIER_CONFIG[tier];

	const pool = getStarterPool(starterId)
		.filter((def) => def.rarity !== "starter")
		.map((def) => ({ id: def.id, weight: rarityWeights[def.rarity] }))
		.filter((c) => c.weight > 0);

	const choices: string[] = [];
	const remaining = pool.slice();

	while (choices.length < MAX_CHOICES && remaining.length > 0) {
		const totalWeight = remaining.reduce((acc, c) => acc + c.weight, 0);
		if (totalWeight === 0) break;

		const roll = rng.next() * totalWeight;
		let acc = 0;
		let pickedIdx = remaining.length - 1;
		for (let i = 0; i < remaining.length; i++) {
			const c = remaining[i];
			if (c === undefined) continue;
			acc += c.weight;
			if (roll < acc) {
				pickedIdx = i;
				break;
			}
		}

		const picked = remaining[pickedIdx];
		if (picked === undefined) break;
		choices.push(picked.id);
		remaining.splice(pickedIdx, 1);
	}

	return choices;
}
