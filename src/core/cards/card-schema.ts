import { asBuffId, asCardId, asStatusId } from "@core/combat/entity.ts";
import { POKEMON_TYPES } from "@core/types/pokemon-types.ts";
import { z } from "zod";
import type { CardDefinition } from "./card-definition.ts";

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

const pokemonTypeSchema = z.enum(POKEMON_TYPES);

const statusIdSchema = z.string().min(1).transform(asStatusId);
const buffIdSchema = z.string().min(1).transform(asBuffId);
const cardIdSchema = z.string().min(1).transform(asCardId);

const scalingSourceSchema = z.enum(["strength", "focus", "rage", "energy", "handSize"]);

const effectScalingSchema = z.object({
	source: scalingSourceSchema,
	factor: z.number(),
});

const effectConditionSchema = z.discriminatedUnion("when", [
	z.object({ when: z.literal("targetHasStatus"), statusId: statusIdSchema }),
	z.object({
		when: z.literal("selfHasBuff"),
		buffId: buffIdSchema,
		minStacks: z.number().int().positive().optional(),
	}),
	z.object({ when: z.literal("energyAtLeast"), amount: z.number().int().nonnegative() }),
	z.object({ when: z.literal("handSizeAtLeast"), count: z.number().int().nonnegative() }),
]);

// ---------------------------------------------------------------------------
// CardEffect discriminated union
// ---------------------------------------------------------------------------

const cardEffectSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("damage"),
		amount: z.number().int().nonnegative(),
		damageTypes: z.array(pokemonTypeSchema).optional(),
		scaling: effectScalingSchema.optional(),
		condition: effectConditionSchema.optional(),
	}),
	z.object({
		kind: z.literal("block"),
		amount: z.number().int().nonnegative(),
		scaling: effectScalingSchema.optional(),
		condition: effectConditionSchema.optional(),
	}),
	z.object({
		kind: z.literal("applyStatus"),
		statusId: statusIdSchema,
		behavior: z.enum(["duration", "intensity"]),
		stacks: z.number().int().positive(),
		toSelf: z.boolean().optional(),
		condition: effectConditionSchema.optional(),
	}),
	z.object({
		kind: z.literal("applyBuff"),
		buffId: buffIdSchema,
		stacks: z.number().int().positive(),
		toSelf: z.boolean().optional(),
		condition: effectConditionSchema.optional(),
	}),
	z.object({
		kind: z.literal("removeStatus"),
		statusId: statusIdSchema,
		fromSelf: z.boolean().optional(),
	}),
	z.object({
		kind: z.literal("heal"),
		amount: z.number().int().nonnegative(),
		scaling: effectScalingSchema.optional(),
	}),
	z.object({
		kind: z.literal("drawCards"),
		count: z.number().int().positive(),
	}),
	z.object({
		kind: z.literal("gainEnergy"),
		amount: z.number().int().positive(),
	}),
	z.object({ kind: z.literal("exhaust") }),
]);

// ---------------------------------------------------------------------------
// CardUpgrade schema
// ---------------------------------------------------------------------------

const cardUpgradeSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().optional(),
	energyCost: z.number().int().nonnegative().optional(),
	effects: z.array(cardEffectSchema).optional(),
});

// ---------------------------------------------------------------------------
// CardDefinition schema
// ---------------------------------------------------------------------------

export const cardDefinitionSchema = z.object({
	id: cardIdSchema,
	name: z.string().min(1),
	description: z.string(),
	types: z.array(pokemonTypeSchema).min(1).max(2),
	category: z.enum(["attack", "skill", "power"]),
	rarity: z.enum(["starter", "common", "uncommon", "rare"]),
	energyCost: z.number().int().nonnegative(),
	target: z.enum(["enemy", "allEnemies", "self", "none"]),
	effects: z.array(cardEffectSchema),
	upgradeMap: cardUpgradeSchema.optional(),
	evolvesTo: cardIdSchema.optional(),
	tags: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

export type CardDefinitionInput = z.input<typeof cardDefinitionSchema>;

/** Validates raw JSON and returns a typed CardDefinition. Throws on failure. */
export function parseCardDefinition(raw: unknown): CardDefinition {
	return cardDefinitionSchema.parse(raw) as CardDefinition;
}

/** Validates without throwing; returns success/error result. */
export function safeParseCardDefinition(
	raw: unknown,
): z.SafeParseReturnType<CardDefinitionInput, CardDefinition> {
	return cardDefinitionSchema.safeParse(raw) as z.SafeParseReturnType<
		CardDefinitionInput,
		CardDefinition
	>;
}
