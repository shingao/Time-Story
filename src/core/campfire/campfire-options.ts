import type { PlayerSnapshot } from "@core/run/types.ts";

// ---------------------------------------------------------------------------
// Branded ID
// ---------------------------------------------------------------------------

export type CampfireOptionId = string & { readonly __brand: "CampfireOptionId" };

function asCampfireOptionId(s: string): CampfireOptionId {
	return s as CampfireOptionId;
}

// ---------------------------------------------------------------------------
// Context and result types
// ---------------------------------------------------------------------------

export interface RunContext {
	readonly playerSnapshot: PlayerSnapshot;
}

export type CampfireExecutionResult =
	| { readonly kind: "instant"; readonly updatedPlayer: PlayerSnapshot }
	| {
			readonly kind: "requires-card-selection";
			readonly onCardSelected: (cardInstanceId: string) => PlayerSnapshot;
	  };

export interface CampfireOption {
	readonly id: CampfireOptionId;
	readonly label: string;
	readonly description: string;
	readonly iconKey: "heart" | "sparkle" | "eye";
	readonly themeColor: string;
	readonly isAvailable: (ctx: RunContext) => boolean;
	readonly execute: (ctx: RunContext) => CampfireExecutionResult;
}

// ---------------------------------------------------------------------------
// Pray — heal 30% max HP
// ---------------------------------------------------------------------------

const pray: CampfireOption = {
	id: asCampfireOptionId("pray"),
	label: "Pray",
	description: "Restore 30% of your max HP.",
	iconKey: "heart",
	themeColor: "#f9a8d4",
	isAvailable: () => true,
	execute: ({ playerSnapshot }) => {
		const heal = Math.floor(playerSnapshot.maxHp * 0.3);
		const newHp = Math.min(playerSnapshot.currentHp + heal, playerSnapshot.maxHp);
		return { kind: "instant", updatedPlayer: { ...playerSnapshot, currentHp: newHp } };
	},
};

// ---------------------------------------------------------------------------
// Train — upgrade one card instance (level 0→1 or 1→2)
// ---------------------------------------------------------------------------

const train: CampfireOption = {
	id: asCampfireOptionId("train"),
	label: "Train",
	description: "Upgrade a card in your deck.",
	iconKey: "sparkle",
	themeColor: "#93c5fd",
	isAvailable: ({ playerSnapshot }) =>
		playerSnapshot.deckCardIds.some((defId, i) => {
			const level = playerSnapshot.cardUpgrades[`${defId}-${i}`] ?? 0;
			return level < 2;
		}),
	execute: (ctx) => ({
		kind: "requires-card-selection",
		onCardSelected: (instanceId) => {
			const current = ctx.playerSnapshot.cardUpgrades[instanceId] ?? 0;
			const nextLevel = Math.min(current + 1, 2) as 0 | 1 | 2;
			return {
				...ctx.playerSnapshot,
				cardUpgrades: { ...ctx.playerSnapshot.cardUpgrades, [instanceId]: nextLevel },
			};
		},
	}),
};

// ---------------------------------------------------------------------------
// Reflect — stub, always disabled; keeps the UI slot reserved for Phase 5.x
// ---------------------------------------------------------------------------

const reflect: CampfireOption = {
	id: asCampfireOptionId("reflect"),
	label: "Reflect",
	description: "Coming soon…",
	iconKey: "eye",
	themeColor: "#c4b5fd",
	isAvailable: () => false,
	execute: (ctx) => ({ kind: "instant", updatedPlayer: ctx.playerSnapshot }),
};

// ---------------------------------------------------------------------------
// Registry — add future options here; UI lists filtered by isAvailable(ctx)
// ---------------------------------------------------------------------------

const CAMPFIRE_REGISTRY: readonly CampfireOption[] = [pray, train, reflect];

/** Returns all registered campfire options including unavailable ones (for UI slot reservation). */
export function getCampfireOptions(): readonly CampfireOption[] {
	return CAMPFIRE_REGISTRY;
}
