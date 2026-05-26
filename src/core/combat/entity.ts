import type { PokemonType } from "@core/types/pokemon-types.ts";

// ---------------------------------------------------------------------------
// Branded ID types — prevents mixing up IDs at compile time
// ---------------------------------------------------------------------------

export type EntityId = string & { readonly __brand: "EntityId" };
export type CardId = string & { readonly __brand: "CardId" };
export type RelicId = string & { readonly __brand: "RelicId" };
export type StatusId = string & { readonly __brand: "StatusId" };
export type BuffId = string & { readonly __brand: "BuffId" };
export type EnemyId = string & { readonly __brand: "EnemyId" };

export function asEntityId(id: string): EntityId {
	return id as EntityId;
}
export function asCardId(id: string): CardId {
	return id as CardId;
}
export function asRelicId(id: string): RelicId {
	return id as RelicId;
}
export function asStatusId(id: string): StatusId {
	return id as StatusId;
}
export function asBuffId(id: string): BuffId {
	return id as BuffId;
}
export function asEnemyId(id: string): EnemyId {
	return id as EnemyId;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type StatusBehavior = "duration" | "intensity";

// All PMD-flavored status conditions
export type KnownStatusId =
	| "burn" // intensity — deals stacks damage per tick, decays by 1
	| "poison" // intensity — deals stacks damage per tick, decays by 1
	| "paralyze" // duration — chance to skip turn
	| "sleep" // duration — skip turns, cleared on hit
	| "frozen" // duration — skip turns, chance to thaw each turn
	| "confused" // duration — chance to hurt self instead of target
	| "doubt"; // PMD-specific intensity — lowers Special Attack (no damage tick)

export interface Status {
	readonly id: StatusId;
	stacks: number;
	readonly behavior: StatusBehavior;
}

// ---------------------------------------------------------------------------
// Buff
// ---------------------------------------------------------------------------

export type KnownBuffId =
	| "strength" // +N to physical attack damage
	| "focus" // +N to special attack damage (PMD equivalent)
	| "aura" // Lucario-specific — reserved for later
	| "rage"; // Charmander signature — +1 damage per stack

export interface Buff {
	readonly id: BuffId;
	stacks: number;
	// undefined = permanent (lasts entire combat); positive = turns remaining
	duration?: number;
}

// ---------------------------------------------------------------------------
// Intent (enemy telegraphing)
// ---------------------------------------------------------------------------

export type Intent =
	| {
			readonly kind: "attack";
			readonly damage: number;
			readonly hits: number; // number of separate hits (renamed from times)
			readonly appliesStatus?: {
				readonly statusId: StatusId;
				readonly stacks: number;
				readonly behavior: StatusBehavior;
			};
	  }
	| { readonly kind: "buff"; readonly buffId: BuffId; readonly stacks: number }
	| {
			readonly kind: "debuff";
			readonly statusId: StatusId;
			readonly stacks: number;
			readonly behavior: StatusBehavior;
	  }
	| { readonly kind: "defend"; readonly block: number }
	| { readonly kind: "unknown" }; // used before AI has rolled

/** Pure-data display string for UI telegraphing — no React dependency. */
export function getIntentDisplayText(intent: Intent): string {
	switch (intent.kind) {
		case "attack":
			return intent.hits > 1
				? `Attack ${intent.damage}×${intent.hits}`
				: `Attack ${intent.damage}`;
		case "buff":
			return `Buff ${String(intent.buffId)} +${intent.stacks}`;
		case "debuff":
			return `Debuff ${String(intent.statusId)} ×${intent.stacks}`;
		case "defend":
			return `Defend ${intent.block}`;
		case "unknown":
			return "???";
	}
}

// ---------------------------------------------------------------------------
// Enemy AI state — per-enemy tracking for intent rolling (serialisable)
// ---------------------------------------------------------------------------

export interface EnemyAiState {
	lastIntentKind: Intent["kind"] | null;
	repeatCount: number;
	cooldowns: Record<number, number>; // intent-pattern index → turns remaining
}

// ---------------------------------------------------------------------------
// Corruption (reserved — Distortion mechanic, Phase 5)
// ---------------------------------------------------------------------------

export interface CorruptionData {
	readonly intensity: number; // 0–3, controls Distortion modifiers
	readonly distortionTokens: number;
}

// ---------------------------------------------------------------------------
// Core combatant interfaces
// ---------------------------------------------------------------------------

export interface Combatant {
	readonly id: EntityId;
	readonly name: string;
	readonly types: readonly PokemonType[];
	hp: number;
	readonly maxHp: number;
	block: number;
	statuses: Status[];
	buffs: Buff[];
}

export interface Player extends Combatant {
	energy: number;
	readonly maxEnergy: number;
	readonly drawPerTurn: number;
}

export interface Enemy extends Combatant {
	intent: Intent;
	definitionId: EnemyId; // links back to EnemyDefinition for AI lookup
	aiState: EnemyAiState;
	readonly corrupted?: CorruptionData; // reserved — never spawned in MVP
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

export interface CreateCombatantParams {
	readonly id: EntityId;
	readonly name: string;
	readonly types: readonly PokemonType[];
	readonly maxHp: number;
}

export function createCombatant(params: CreateCombatantParams): Combatant {
	return {
		id: params.id,
		name: params.name,
		types: params.types,
		hp: params.maxHp,
		maxHp: params.maxHp,
		block: 0,
		statuses: [],
		buffs: [],
	};
}

export interface CreatePlayerParams extends CreateCombatantParams {
	readonly maxEnergy?: number;
	readonly drawPerTurn?: number;
}

export function createPlayer(params: CreatePlayerParams): Player {
	return {
		...createCombatant(params),
		energy: params.maxEnergy ?? 3,
		maxEnergy: params.maxEnergy ?? 3,
		drawPerTurn: params.drawPerTurn ?? 5,
	};
}

export interface CreateEnemyParams extends CreateCombatantParams {
	readonly definitionId?: EnemyId; // optional; defaults to "unknown" for test fixtures
	readonly corrupted?: CorruptionData;
}

export function createEnemy(params: CreateEnemyParams): Enemy {
	return {
		...createCombatant(params),
		intent: { kind: "unknown" },
		definitionId: params.definitionId ?? asEnemyId("unknown"),
		aiState: { lastIntentKind: null, repeatCount: 0, cooldowns: {} },
		...(params.corrupted !== undefined ? { corrupted: params.corrupted } : {}),
	};
}

// ---------------------------------------------------------------------------
// Status/buff helpers used throughout combat
// ---------------------------------------------------------------------------

export function findStatus(combatant: Combatant, id: StatusId): Status | undefined {
	return combatant.statuses.find((s) => s.id === id);
}

export function findBuff(combatant: Combatant, id: BuffId): Buff | undefined {
	return combatant.buffs.find((b) => b.id === id);
}

export function applyStatus(combatant: Combatant, status: Status): void {
	const existing = findStatus(combatant, status.id);
	if (existing !== undefined) {
		existing.stacks += status.stacks;
	} else {
		combatant.statuses.push({ ...status });
	}
}

export function applyBuff(combatant: Combatant, buff: Buff): void {
	const existing = findBuff(combatant, buff.id);
	if (existing !== undefined) {
		existing.stacks += buff.stacks;
	} else {
		combatant.buffs.push({ ...buff });
	}
}

export function removeStatus(combatant: Combatant, id: StatusId): void {
	combatant.statuses = combatant.statuses.filter((s) => s.id !== id);
}

export function removeBuff(combatant: Combatant, id: BuffId): void {
	combatant.buffs = combatant.buffs.filter((b) => b.id !== id);
}

export function isAlive(combatant: Combatant): boolean {
	return combatant.hp > 0;
}

export function takeDamage(combatant: Combatant, amount: number): number {
	const absorbed = Math.min(combatant.block, amount);
	const remainder = amount - absorbed;
	combatant.block = Math.max(0, combatant.block - amount);
	combatant.hp = Math.max(0, combatant.hp - remainder);
	return remainder; // actual HP damage dealt
}

export function gainBlock(combatant: Combatant, amount: number): void {
	combatant.block += amount;
}

export function heal(combatant: Combatant, amount: number): void {
	combatant.hp = Math.min(combatant.maxHp, combatant.hp + amount);
}
