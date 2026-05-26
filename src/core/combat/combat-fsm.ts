import { rollIntent } from "@core/enemies/enemy-ai.ts";
import { getEnemyDefinition } from "@core/enemies/enemy-registry.ts";
import type { Rng } from "@core/rng/rng.ts";
import type { CombatContext } from "./effects/effect-handler.ts";
import { beginPlayerTurn, registerDefaultHandlers } from "./turn-engine.ts";

// ---------------------------------------------------------------------------
// Combat FSM entry point
// ---------------------------------------------------------------------------

/**
 * Initialises a combat from an already-constructed CombatContext:
 *  1. Registers the default handler set (damage-applier, block-reset).
 *  2. Emits COMBAT_START.
 *  3. Rolls the first intent for every enemy (telegraphed before player acts).
 *  4. Sets phase to PLAYER_TURN and runs the first player turn start sequence.
 *
 * The CombatContext must already contain the full initial CombatState
 * (player + enemies + shuffled draw pile).  Callers (Zustand store, tests)
 * build the state and call startCombat once.
 */
export function startCombat(ctx: CombatContext, rng: Rng): void {
	registerDefaultHandlers(ctx);

	ctx.emit({ type: "COMBAT_START" });

	// Roll the first telegraphed intent for each enemy so the player can see
	// what is coming before they take their first action.
	for (const enemy of ctx.state.enemies) {
		const def = getEnemyDefinition(enemy.definitionId);
		enemy.intent = rollIntent(enemy, def, ctx, rng);
		ctx.emit({ type: "ENEMY_INTENT_RESOLVED", enemyId: enemy.id, intent: enemy.intent });
	}

	ctx.phase = "PLAYER_TURN";
	beginPlayerTurn(ctx, rng);
}
