import { generateDungeonMap } from "@core/dungeon/mapGenerator.ts";
import type { SerializedDungeonMap } from "@core/dungeon/schema.ts";
import { serializeDungeonMap } from "@core/dungeon/schema.ts";
import type { NodeId } from "@core/dungeon/types.ts";
import { asNodeId } from "@core/dungeon/types.ts";
import type { CombatTier, RewardData } from "@core/rewards/reward-generator.ts";
import { generateCardReward, generateRewardGold } from "@core/rewards/reward-generator.ts";
import { Rng } from "@core/rng/rng.ts";
import type { PlayerSnapshot, RunStatus, StarterName } from "@core/run/types.ts";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface RunStoreState {
	readonly seed: number;
	readonly starterId: StarterName | null;
	readonly currentAct: number;
	readonly serializedMap: SerializedDungeonMap | null;
	readonly currentNodeId: string | null; // NodeId as string for JSON compat
	readonly visitedNodeIds: readonly string[]; // NodeId[] as strings
	readonly nodeEncounters: Readonly<Record<string, string>>; // NodeId → EnemyId
	readonly playerSnapshot: PlayerSnapshot;
	readonly pendingReward: RewardData | null;
	readonly status: RunStatus;
}

interface RunStoreActions {
	startRun(seed: number, starterId: StarterName): void;
	travelToNode(nodeId: NodeId): void;
	returnToMap(outcome: { finalHp?: number; goldDelta?: number; newCardId?: string }): void;
	completeCampfire(updatedPlayer: PlayerSnapshot): void;
	startReward(finalHp: number): void;
	completeReward(pickedCardId?: string): void;
	endRun(result: "victory" | "defeat"): void;
	clearRun(): void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SNAPSHOT: PlayerSnapshot = {
	currentHp: 0,
	maxHp: 0,
	gold: 0,
	deckCardIds: [],
	relicIds: [],
	partnerState: null,
	timeGearCount: 0,
	cardUpgrades: {},
};

const STARTER_SNAPSHOTS: Record<StarterName, Omit<PlayerSnapshot, "deckCardIds">> = {
	charmander: {
		currentHp: 44,
		maxHp: 44,
		gold: 0,
		relicIds: [],
		partnerState: null,
		timeGearCount: 0,
		cardUpgrades: {},
	},
	treecko: {
		currentHp: 40,
		maxHp: 40,
		gold: 0,
		relicIds: [],
		partnerState: null,
		timeGearCount: 0,
		cardUpgrades: {},
	},
};

const STARTER_DECK_IDS: Record<StarterName, readonly string[]> = {
	charmander: [...Array(5).fill("scratch"), ...Array(4).fill("growl"), "ember"],
	treecko: [...Array(5).fill("pound"), ...Array(4).fill("harden"), "absorb"],
};

// ---------------------------------------------------------------------------
// Enemy pool helpers
// ---------------------------------------------------------------------------

function getEnemyPool(floor: number, type: "combat" | "elite"): readonly string[] {
	if (type === "elite") return ["beedrill-elite"];
	if (floor <= 4) return ["pidgey", "caterpie", "zubat"];
	if (floor <= 9) return ["caterpie", "zubat", "mankey"];
	return ["zubat", "mankey"];
}

function assignEncounters(serializedMap: SerializedDungeonMap, rng: Rng): Record<string, string> {
	const encounters: Record<string, string> = {};
	for (const node of serializedMap.nodes) {
		if (node.type === "combat" || node.type === "elite") {
			const pool = getEnemyPool(node.floor, node.type);
			const idx = rng.nextInt(0, pool.length - 1);
			const enemyId = pool[idx];
			if (enemyId !== undefined) {
				encounters[node.id] = enemyId;
			}
		}
	}
	return encounters;
}

// ---------------------------------------------------------------------------
// computeAvailableNodeIds — exported for use by MapScene
// ---------------------------------------------------------------------------

export function computeAvailableNodeIds(
	map: {
		readonly nodes: ReadonlyMap<NodeId, { readonly edges: readonly NodeId[] }>;
		readonly startNodeIds: readonly NodeId[];
	},
	currentNodeId: NodeId | null,
	visitedNodeIds: ReadonlySet<NodeId>,
): ReadonlySet<NodeId> {
	if (currentNodeId === null) {
		return new Set(map.startNodeIds);
	}
	if (!visitedNodeIds.has(currentNodeId)) {
		// Re-entry after refresh — must complete current node first
		return new Set([currentNodeId]);
	}
	// Return edges that haven't been visited
	const currentNode = map.nodes.get(currentNodeId);
	if (!currentNode) return new Set<NodeId>();
	const available = new Set<NodeId>();
	for (const edgeId of currentNode.edges) {
		if (!visitedNodeIds.has(edgeId)) {
			available.add(edgeId);
		}
	}
	return available;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: RunStoreState = {
	seed: 0,
	starterId: null,
	currentAct: 1,
	serializedMap: null,
	currentNodeId: null,
	visitedNodeIds: [],
	nodeEncounters: {},
	playerSnapshot: DEFAULT_SNAPSHOT,
	pendingReward: null,
	status: "in_map",
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRunStore = create<RunStoreState & RunStoreActions>()(
	persist(
		(set, get) => ({
			...INITIAL_STATE,

			startRun(seed, starterId) {
				const rng = new Rng(seed >>> 0);
				const map = generateDungeonMap(seed, 1);
				const serializedMap = serializeDungeonMap(map);
				const encounters = assignEncounters(serializedMap, rng);
				const meta = STARTER_SNAPSHOTS[starterId];
				const snapshot: PlayerSnapshot = {
					...meta,
					deckCardIds: STARTER_DECK_IDS[starterId],
				};
				set({
					seed: seed >>> 0,
					starterId,
					currentAct: 1,
					serializedMap,
					currentNodeId: null,
					visitedNodeIds: [],
					nodeEncounters: encounters,
					playerSnapshot: snapshot,
					status: "in_map",
				});
			},

			travelToNode(nodeId) {
				const { serializedMap } = get();
				if (!serializedMap) return;
				const node = serializedMap.nodes.find((n) => n.id === String(nodeId));
				if (!node) return;
				const statusMap: Record<string, RunStatus> = {
					combat: "in_combat",
					elite: "in_combat",
					event: "in_event",
					shop: "in_shop",
					campfire: "in_campfire",
					treasure: "in_treasure",
					boss: "in_map", // boss stub shows modal on map
				};
				set({
					currentNodeId: String(nodeId),
					status: statusMap[node.type] ?? "in_map",
				});
			},

			returnToMap(outcome) {
				const { currentNodeId, visitedNodeIds, playerSnapshot } = get();
				if (!currentNodeId) return;
				const newHp = outcome.finalHp ?? playerSnapshot.currentHp;
				const newGold = playerSnapshot.gold + (outcome.goldDelta ?? 0);
				const newDeck = outcome.newCardId
					? [...playerSnapshot.deckCardIds, outcome.newCardId]
					: playerSnapshot.deckCardIds;
				set({
					visitedNodeIds: [...visitedNodeIds, currentNodeId],
					playerSnapshot: {
						...playerSnapshot,
						currentHp: Math.min(newHp, playerSnapshot.maxHp),
						gold: newGold,
						deckCardIds: newDeck,
					},
					status: "in_map",
				});
			},

			completeCampfire(updatedPlayer) {
				const { currentNodeId, visitedNodeIds } = get();
				if (!currentNodeId) return;
				set({
					visitedNodeIds: [...visitedNodeIds, currentNodeId],
					playerSnapshot: updatedPlayer,
					status: "in_map",
				});
			},

			startReward(finalHp) {
				const { currentNodeId, serializedMap, seed, starterId, playerSnapshot } = get();
				if (!currentNodeId || !serializedMap || !starterId) return;

				const node = serializedMap.nodes.find((n) => n.id === currentNodeId);
				if (!node) return;

				const tierMap: Record<string, CombatTier> = {
					combat: "normal",
					elite: "elite",
					boss: "boss",
				};
				const tier: CombatTier = tierMap[node.type] ?? "normal";

				// Deterministic seed derived from run seed + node id hash
				const nodeHash = currentNodeId
					.split("")
					.reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) | 0) >>> 0, 0);
				const rewardSeed = (seed ^ nodeHash) >>> 0;
				const rng = new Rng(rewardSeed);

				const gold = generateRewardGold(tier, rng);
				const cardChoices = generateCardReward(starterId, tier, rng);

				const reward: RewardData = { gold, cardChoices, tier, relicChoice: null };

				set({
					playerSnapshot: {
						...playerSnapshot,
						currentHp: Math.min(finalHp, playerSnapshot.maxHp),
					},
					pendingReward: reward,
					status: "in_reward",
				});
			},

			completeReward(pickedCardId) {
				const { currentNodeId, visitedNodeIds, playerSnapshot, pendingReward } = get();
				if (!currentNodeId || !pendingReward) return;

				const newGold = playerSnapshot.gold + pendingReward.gold;
				const newDeck = pickedCardId
					? [...playerSnapshot.deckCardIds, pickedCardId]
					: playerSnapshot.deckCardIds;

				set({
					visitedNodeIds: [...visitedNodeIds, currentNodeId],
					playerSnapshot: {
						...playerSnapshot,
						gold: newGold,
						deckCardIds: newDeck,
					},
					pendingReward: null,
					status: "in_map",
				});
			},

			endRun(result) {
				set({ status: result });
			},

			clearRun() {
				set(INITIAL_STATE);
			},
		}),
		{
			name: "pmd-run-v3",
			version: 3,
			migrate: (_persisted, _version) => INITIAL_STATE,
			onRehydrateStorage: () => (state) => {
				// Refresh mid-combat or mid-campfire: reset to map so player re-enters the room.
				// in_reward is intentionally preserved so the same reward appears after refresh.
				if (state && (state.status === "in_combat" || state.status === "in_campfire")) {
					state.status = "in_map";
				}
			},
		},
	),
);

// ---------------------------------------------------------------------------
// Re-export asNodeId for convenience
// ---------------------------------------------------------------------------
export { asNodeId };
