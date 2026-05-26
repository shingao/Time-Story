import { asBuffId, asEnemyId, asStatusId } from "@core/combat/entity.ts";
import { POKEMON_TYPES } from "@core/types/pokemon-types.ts";
import { z } from "zod";
import type { AiRule, EnemyDefinition, IntentCondition, IntentPattern } from "./enemy-types.ts";

// ---------------------------------------------------------------------------
// Intent schema (discriminated union matching the Intent type in entity.ts)
// ---------------------------------------------------------------------------

const attackIntentSchema = z.object({
	kind: z.literal("attack"),
	damage: z.number().int().positive(),
	hits: z.number().int().positive().default(1),
	appliesStatus: z
		.object({
			statusId: z.string().min(1).transform(asStatusId),
			stacks: z.number().int().positive(),
			behavior: z.enum(["duration", "intensity"]),
		})
		.optional(),
});

const buffIntentSchema = z.object({
	kind: z.literal("buff"),
	buffId: z.string().min(1).transform(asBuffId),
	stacks: z.number().int().positive(),
});

const debuffIntentSchema = z.object({
	kind: z.literal("debuff"),
	statusId: z.string().min(1).transform(asStatusId),
	stacks: z.number().int().positive(),
	behavior: z.enum(["duration", "intensity"]),
});

const defendIntentSchema = z.object({
	kind: z.literal("defend"),
	block: z.number().int().positive(),
});

const intentSchema = z.discriminatedUnion("kind", [
	attackIntentSchema,
	buffIntentSchema,
	debuffIntentSchema,
	defendIntentSchema,
]);

// ---------------------------------------------------------------------------
// IntentCondition schema
// ---------------------------------------------------------------------------

const intentConditionSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("hp_below"), threshold: z.number().min(0).max(1) }),
	z.object({ kind: z.literal("hp_above"), threshold: z.number().min(0).max(1) }),
	z.object({ kind: z.literal("turn_at_least"), turn: z.number().int().positive() }),
	z.object({ kind: z.literal("turn_at_most"), turn: z.number().int().nonnegative() }),
	z.object({
		kind: z.literal("last_intent_was"),
		intentKind: z.enum(["attack", "buff", "debuff", "defend", "unknown"]),
	}),
	z.object({
		kind: z.literal("last_intent_was_not"),
		intentKind: z.enum(["attack", "buff", "debuff", "defend", "unknown"]),
	}),
	z.object({
		kind: z.literal("player_has_status"),
		statusId: z.string().min(1).transform(asStatusId),
	}),
]) satisfies z.ZodType<IntentCondition>;

// ---------------------------------------------------------------------------
// AiRule schema
// ---------------------------------------------------------------------------

const aiRuleSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("no_repeat_in_a_row"),
		maxRepeats: z.number().int().positive(),
	}),
	z.object({
		kind: z.literal("forced_opener"),
		intentIndex: z.number().int().nonnegative(),
	}),
	z.object({
		kind: z.literal("forced_finisher"),
		intentIndex: z.number().int().nonnegative(),
		whenHpBelow: z.number().min(0).max(1),
	}),
]) satisfies z.ZodType<AiRule>;

// ---------------------------------------------------------------------------
// IntentPattern schema
// ---------------------------------------------------------------------------

const intentPatternSchema = z.object({
	weight: z.number().positive(),
	intent: intentSchema,
	condition: intentConditionSchema.optional(),
	cooldown: z.number().int().nonnegative().optional(),
}) satisfies z.ZodType<IntentPattern>;

// ---------------------------------------------------------------------------
// EnemyDefinition schema
// ---------------------------------------------------------------------------

export const enemyDefinitionSchema = z
	.object({
		id: z.string().min(1).transform(asEnemyId),
		name: z.string().min(1),
		types: z
			.array(z.enum(POKEMON_TYPES))
			.min(1)
			.transform((arr) => arr as [(typeof arr)[number], ...typeof arr]),
		hp: z
			.object({
				min: z.number().int().positive(),
				max: z.number().int().positive(),
			})
			.refine((v) => v.min <= v.max, { message: "hp.min must be ≤ hp.max" }),
		tier: z.enum(["normal", "elite", "boss"]),
		intents: z.array(intentPatternSchema).min(1),
		aiRules: z.array(aiRuleSchema).optional(),
		spriteId: z.string().optional(),
		resistances: z.array(z.enum(POKEMON_TYPES)).optional(),
	})
	.refine(
		(v) => {
			for (const rule of v.aiRules ?? []) {
				if (rule.kind === "forced_opener" || rule.kind === "forced_finisher") {
					if (rule.intentIndex >= v.intents.length) return false;
				}
			}
			return true;
		},
		{ message: "aiRule intentIndex out of bounds" },
	) satisfies z.ZodType<EnemyDefinition>;

/** Parses raw JSON into a validated EnemyDefinition. Throws on failure. */
export function parseEnemyDefinition(raw: unknown): EnemyDefinition {
	return enemyDefinitionSchema.parse(raw);
}
