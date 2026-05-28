import { deserializeDungeonMap } from "@core/dungeon/schema.ts";
import { asNodeId } from "@core/dungeon/types.ts";
import { beforeEach, describe, expect, it } from "vitest";
import { computeAvailableNodeIds, useRunStore } from "./useRunStore.ts";

// ---------------------------------------------------------------------------
// Reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	useRunStore.getState().clearRun();
});

// ---------------------------------------------------------------------------
// startRun
// ---------------------------------------------------------------------------

describe("startRun", () => {
	it("creates a valid serialized map with nodes", () => {
		useRunStore.getState().startRun(42, "charmander");
		const state = useRunStore.getState();
		expect(state.serializedMap).not.toBeNull();
		expect(state.serializedMap?.nodes.length).toBeGreaterThan(0);
	});

	it("sets charmander starting HP to 44", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { playerSnapshot } = useRunStore.getState();
		expect(playerSnapshot.currentHp).toBe(44);
		expect(playerSnapshot.maxHp).toBe(44);
	});

	it("sets treecko starting HP to 40", () => {
		useRunStore.getState().startRun(42, "treecko");
		const { playerSnapshot } = useRunStore.getState();
		expect(playerSnapshot.currentHp).toBe(40);
		expect(playerSnapshot.maxHp).toBe(40);
	});

	it("sets charmander starter deck (10 cards)", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { playerSnapshot } = useRunStore.getState();
		expect(playerSnapshot.deckCardIds).toHaveLength(10);
		expect(playerSnapshot.deckCardIds.filter((id) => id === "scratch")).toHaveLength(5);
		expect(playerSnapshot.deckCardIds.filter((id) => id === "growl")).toHaveLength(4);
		expect(playerSnapshot.deckCardIds.filter((id) => id === "ember")).toHaveLength(1);
	});

	it("sets treecko starter deck (10 cards)", () => {
		useRunStore.getState().startRun(99, "treecko");
		const { playerSnapshot } = useRunStore.getState();
		expect(playerSnapshot.deckCardIds).toHaveLength(10);
		expect(playerSnapshot.deckCardIds.filter((id) => id === "pound")).toHaveLength(5);
		expect(playerSnapshot.deckCardIds.filter((id) => id === "harden")).toHaveLength(4);
		expect(playerSnapshot.deckCardIds.filter((id) => id === "absorb")).toHaveLength(1);
	});

	it("initializes currentNodeId to null (at entrance)", () => {
		useRunStore.getState().startRun(42, "charmander");
		expect(useRunStore.getState().currentNodeId).toBeNull();
	});

	it("initializes visitedNodeIds to empty", () => {
		useRunStore.getState().startRun(42, "charmander");
		expect(useRunStore.getState().visitedNodeIds).toHaveLength(0);
	});

	it("sets status to in_map", () => {
		useRunStore.getState().startRun(42, "charmander");
		expect(useRunStore.getState().status).toBe("in_map");
	});

	it("assigns encounters to combat/elite nodes", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { nodeEncounters, serializedMap } = useRunStore.getState();
		expect(Object.keys(nodeEncounters).length).toBeGreaterThan(0);
		// All encounter keys should match combat/elite nodes
		for (const nodeId of Object.keys(nodeEncounters)) {
			const node = serializedMap?.nodes.find((n) => n.id === nodeId);
			expect(node).toBeDefined();
			expect(["combat", "elite"]).toContain(node?.type);
		}
	});
});

// ---------------------------------------------------------------------------
// travelToNode
// ---------------------------------------------------------------------------

describe("travelToNode", () => {
	it("sets status to in_combat for a combat node", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const combatNode = serializedMap?.nodes.find((n) => n.type === "combat");
		expect(combatNode).toBeDefined();
		useRunStore.getState().travelToNode(asNodeId(combatNode?.id));
		expect(useRunStore.getState().status).toBe("in_combat");
	});

	it("sets currentNodeId but does NOT add to visitedNodeIds", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const combatNode = serializedMap?.nodes.find((n) => n.type === "combat");
		expect(combatNode).toBeDefined();
		const nodeId = asNodeId(combatNode?.id);
		useRunStore.getState().travelToNode(nodeId);
		const state = useRunStore.getState();
		expect(state.currentNodeId).toBe(combatNode?.id);
		expect(state.visitedNodeIds).not.toContain(combatNode?.id);
	});

	it("sets status to in_event for an event node", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const eventNode = serializedMap?.nodes.find((n) => n.type === "event");
		if (!eventNode) return; // Skip if no event node in this seed
		useRunStore.getState().travelToNode(asNodeId(eventNode.id));
		expect(useRunStore.getState().status).toBe("in_event");
	});

	it("sets status to in_campfire for a campfire node", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const campfireNode = serializedMap?.nodes.find((n) => n.type === "campfire");
		if (!campfireNode) return;
		useRunStore.getState().travelToNode(asNodeId(campfireNode.id));
		expect(useRunStore.getState().status).toBe("in_campfire");
	});
});

// ---------------------------------------------------------------------------
// returnToMap
// ---------------------------------------------------------------------------

describe("returnToMap", () => {
	it("adds currentNodeId to visitedNodeIds", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const combatNode = serializedMap?.nodes.find((n) => n.type === "combat");
		expect(combatNode).toBeDefined();
		const nodeId = asNodeId(combatNode?.id);
		useRunStore.getState().travelToNode(nodeId);
		useRunStore.getState().returnToMap({});
		expect(useRunStore.getState().visitedNodeIds).toContain(combatNode?.id);
	});

	it("sets status to in_map", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const combatNode = serializedMap?.nodes.find((n) => n.type === "combat");
		useRunStore.getState().travelToNode(asNodeId(combatNode?.id));
		useRunStore.getState().returnToMap({});
		expect(useRunStore.getState().status).toBe("in_map");
	});

	it("updates HP from finalHp outcome", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const combatNode = serializedMap?.nodes.find((n) => n.type === "combat");
		useRunStore.getState().travelToNode(asNodeId(combatNode?.id));
		useRunStore.getState().returnToMap({ finalHp: 30 });
		expect(useRunStore.getState().playerSnapshot.currentHp).toBe(30);
	});

	it("applies goldDelta correctly", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const combatNode = serializedMap?.nodes.find((n) => n.type === "combat");
		useRunStore.getState().travelToNode(asNodeId(combatNode?.id));
		useRunStore.getState().returnToMap({ goldDelta: 15 });
		expect(useRunStore.getState().playerSnapshot.gold).toBe(15);
	});

	it("does not exceed maxHp when finalHp > maxHp", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const combatNode = serializedMap?.nodes.find((n) => n.type === "combat");
		useRunStore.getState().travelToNode(asNodeId(combatNode?.id));
		useRunStore.getState().returnToMap({ finalHp: 999 });
		const { playerSnapshot } = useRunStore.getState();
		expect(playerSnapshot.currentHp).toBe(playerSnapshot.maxHp);
	});

	it("adds newCardId to deckCardIds", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const combatNode = serializedMap?.nodes.find((n) => n.type === "combat");
		useRunStore.getState().travelToNode(asNodeId(combatNode?.id));
		useRunStore.getState().returnToMap({ newCardId: "ember" });
		const { deckCardIds } = useRunStore.getState().playerSnapshot;
		expect(deckCardIds[deckCardIds.length - 1]).toBe("ember");
		expect(deckCardIds).toHaveLength(11);
	});
});

// ---------------------------------------------------------------------------
// completeCampfire
// ---------------------------------------------------------------------------

describe("completeCampfire", () => {
	it("marks the campfire node as visited and returns to in_map", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const campfireNode = serializedMap?.nodes.find((n) => n.type === "campfire");
		if (!campfireNode) return; // skip if seed has no campfire node
		useRunStore.getState().travelToNode(asNodeId(campfireNode.id));
		expect(useRunStore.getState().status).toBe("in_campfire");

		const updatedPlayer = {
			...useRunStore.getState().playerSnapshot,
			currentHp: 40,
		};
		useRunStore.getState().completeCampfire(updatedPlayer);

		const state = useRunStore.getState();
		expect(state.status).toBe("in_map");
		expect(state.visitedNodeIds).toContain(campfireNode.id);
		expect(state.playerSnapshot.currentHp).toBe(40);
	});

	it("preserves serializedMap (run stays active) after campfire", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const campfireNode = serializedMap?.nodes.find((n) => n.type === "campfire");
		if (!campfireNode) return;
		useRunStore.getState().travelToNode(asNodeId(campfireNode.id));
		useRunStore.getState().completeCampfire(useRunStore.getState().playerSnapshot);

		expect(useRunStore.getState().serializedMap).not.toBeNull();
	});

	it("persists cardUpgrades from completeCampfire to subsequent playerSnapshot", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap, playerSnapshot } = useRunStore.getState();
		const campfireNode = serializedMap?.nodes.find((n) => n.type === "campfire");
		if (!campfireNode) return;
		useRunStore.getState().travelToNode(asNodeId(campfireNode.id));

		const withUpgrade = {
			...playerSnapshot,
			cardUpgrades: { "scratch-0": 1 as const },
		};
		useRunStore.getState().completeCampfire(withUpgrade);

		const state = useRunStore.getState();
		expect(state.playerSnapshot.cardUpgrades["scratch-0"]).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// endRun
// ---------------------------------------------------------------------------

describe("endRun", () => {
	it("sets status to defeat", () => {
		useRunStore.getState().startRun(42, "charmander");
		useRunStore.getState().endRun("defeat");
		expect(useRunStore.getState().status).toBe("defeat");
	});

	it("sets status to victory", () => {
		useRunStore.getState().startRun(42, "charmander");
		useRunStore.getState().endRun("victory");
		expect(useRunStore.getState().status).toBe("victory");
	});
});

// ---------------------------------------------------------------------------
// clearRun
// ---------------------------------------------------------------------------

describe("clearRun", () => {
	it("resets all state to initial values", () => {
		useRunStore.getState().startRun(42, "charmander");
		useRunStore.getState().clearRun();
		const state = useRunStore.getState();
		expect(state.serializedMap).toBeNull();
		expect(state.starterId).toBeNull();
		expect(state.currentNodeId).toBeNull();
		expect(state.visitedNodeIds).toHaveLength(0);
		expect(state.status).toBe("in_map");
		expect(state.playerSnapshot.currentHp).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Run lifecycle regression — combat win must not discard the run
// ---------------------------------------------------------------------------

describe("run lifecycle regression — combat result routing", () => {
	it("win: returnToMap leaves run active, node visited, status in_map", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const combatNode = serializedMap?.nodes.find((n) => n.type === "combat");
		expect(combatNode).toBeDefined();
		const nodeId = asNodeId(combatNode?.id);

		useRunStore.getState().travelToNode(nodeId);
		expect(useRunStore.getState().status).toBe("in_combat");

		useRunStore.getState().returnToMap({ finalHp: 38 });

		const state = useRunStore.getState();
		// Run must remain active — serializedMap must not be cleared
		expect(state.serializedMap).not.toBeNull();
		expect(state.status).toBe("in_map");
		expect(state.visitedNodeIds).toContain(combatNode?.id);
		expect(state.playerSnapshot.currentHp).toBe(38);
	});

	it("defeat: endRun sets defeat status, run data preserved for DefeatScreen", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const combatNode = serializedMap?.nodes.find((n) => n.type === "combat");
		expect(combatNode).toBeDefined();
		useRunStore.getState().travelToNode(asNodeId(combatNode?.id));

		useRunStore.getState().endRun("defeat");

		const state = useRunStore.getState();
		expect(state.status).toBe("defeat");
		// serializedMap must NOT be cleared — MapScene needs it to render DefeatScreen
		expect(state.serializedMap).not.toBeNull();
	});

	it("chain of 3 combats: each win accumulates visited nodes and preserves HP", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const map = deserializeDungeonMap(serializedMap);

		const n1 = map.startNodeIds[0];
		if (!n1) return;
		useRunStore.getState().travelToNode(n1);
		useRunStore.getState().returnToMap({ finalHp: 40 });

		const node1 = map.nodes.get(n1);
		if (!node1) return;
		const n2 = node1.edges[0];
		if (!n2) return;
		useRunStore.getState().travelToNode(n2);
		useRunStore.getState().returnToMap({ finalHp: 35 });

		const node2 = map.nodes.get(n2);
		if (!node2) return;
		const n3 = node2.edges[0];
		if (!n3) return;
		useRunStore.getState().travelToNode(n3);
		useRunStore.getState().returnToMap({ finalHp: 30 });

		const state = useRunStore.getState();
		expect(state.status).toBe("in_map");
		expect(state.visitedNodeIds).toContain(n1);
		expect(state.visitedNodeIds).toContain(n2);
		expect(state.visitedNodeIds).toContain(n3);
		expect(state.playerSnapshot.currentHp).toBe(30);
		expect(state.serializedMap).not.toBeNull();
	});

	it("stub room (event): returnToMap leaves run active with node visited", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const eventNode = serializedMap?.nodes.find((n) => n.type === "event");
		if (!eventNode) return; // skip if seed has no event node
		useRunStore.getState().travelToNode(asNodeId(eventNode.id));
		expect(useRunStore.getState().status).toBe("in_event");

		useRunStore.getState().returnToMap({});

		const state = useRunStore.getState();
		expect(state.status).toBe("in_map");
		expect(state.visitedNodeIds).toContain(eventNode.id);
		expect(state.serializedMap).not.toBeNull();
	});

	it("boss win: endRun('victory') sets status to victory; clearRun resets for return to menu", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const bossNode = serializedMap?.nodes.find((n) => n.type === "boss");
		expect(bossNode).toBeDefined();
		useRunStore.getState().travelToNode(asNodeId(bossNode?.id));
		expect(useRunStore.getState().status).toBe("in_map"); // boss stays on map

		useRunStore.getState().endRun("victory");
		const mid = useRunStore.getState();
		expect(mid.status).toBe("victory");
		expect(mid.serializedMap).not.toBeNull(); // VictoryScreen renders on top of MapScene

		// Simulate "Return to Guild" button
		useRunStore.getState().clearRun();
		const final = useRunStore.getState();
		expect(final.serializedMap).toBeNull();
		expect(final.status).toBe("in_map"); // reset to initial
	});
});

// ---------------------------------------------------------------------------
// computeAvailableNodeIds
// ---------------------------------------------------------------------------

describe("computeAvailableNodeIds", () => {
	it("returns startNodeIds when currentNodeId is null (new run)", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const map = deserializeDungeonMap(serializedMap);
		const available = computeAvailableNodeIds(map, null, new Set());
		for (const startId of map.startNodeIds) {
			expect(available.has(startId)).toBe(true);
		}
	});

	it("returns only currentNodeId when it's not in visitedNodeIds (re-entry)", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const map = deserializeDungeonMap(serializedMap);
		const startNode = map.startNodeIds[0];
		if (!startNode) return;
		const available = computeAvailableNodeIds(map, startNode, new Set());
		expect(available.size).toBe(1);
		expect(available.has(startNode)).toBe(true);
	});

	it("returns forward edges when currentNodeId is visited", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const map = deserializeDungeonMap(serializedMap);
		const startNode = map.startNodeIds[0];
		if (!startNode) return;
		const visited = new Set([startNode]);
		const available = computeAvailableNodeIds(map, startNode, visited);
		// Should be edges of startNode
		const node = map.nodes.get(startNode);
		if (!node) return;
		for (const edgeId of node.edges) {
			expect(available.has(edgeId)).toBe(true);
		}
	});

	it("does not include already-visited edges", () => {
		useRunStore.getState().startRun(42, "charmander");
		const { serializedMap } = useRunStore.getState();
		const map = deserializeDungeonMap(serializedMap);
		const startNode = map.startNodeIds[0];
		if (!startNode) return;
		const node = map.nodes.get(startNode);
		if (!node) return;
		const firstEdge = node.edges[0];
		if (!firstEdge) return;
		// Visit both startNode and firstEdge
		const visited = new Set([startNode, firstEdge]);
		const available = computeAvailableNodeIds(map, startNode, visited);
		expect(available.has(firstEdge)).toBe(false);
	});
});
