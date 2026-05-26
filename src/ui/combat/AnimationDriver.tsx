import { useCombatStore } from "@state/useCombatStore.ts";
import { useFloatingNumbersStore } from "@state/useFloatingNumbersStore.ts";
import { useUIStore } from "@state/useUIStore.ts";
import { useEffect, useRef } from "react";
import { animationBus } from "./animationBus.ts";

// ---------------------------------------------------------------------------
// Delay per animation speed mode (ms between frame consumptions)
// ---------------------------------------------------------------------------

const FRAME_DELAY: Record<string, number> = {
	normal: 180,
	fast: 60,
	instant: 0,
};

// ---------------------------------------------------------------------------
// Headless component — subscribes to the queue head and drives animations
// ---------------------------------------------------------------------------

export function AnimationDriver() {
	const frame = useCombatStore((s) => s.animationQueue[0]);
	const consumeAnimationFrame = useCombatStore((s) => s.consumeAnimationFrame);
	const clearAnimationQueue = useCombatStore((s) => s.clearAnimationQueue);
	const animationSpeed = useUIStore((s) => s.animationSpeed);
	const spawnNumber = useFloatingNumbersStore((s) => s.spawn);

	// Guard against re-processing the same frame (StrictMode double-invoke safe)
	const processingTickRef = useRef<number | null>(null);

	useEffect(() => {
		if (!frame) return;
		if (processingTickRef.current === frame.tick) return;

		processingTickRef.current = frame.tick;

		// Instant mode — drain the whole queue immediately
		if (animationSpeed === "instant") {
			clearAnimationQueue();
			return () => {
				if (processingTickRef.current === frame.tick) {
					processingTickRef.current = null;
				}
			};
		}

		// Dispatch visual side-effects
		const { event } = frame;

		if (event.type === "DAMAGE_DEALT") {
			animationBus.emit(`shake:${String(event.targetId)}`);
			spawnNumber(String(event.targetId), event.finalAmount);
		} else if (event.type === "ENTITY_DEFEATED") {
			animationBus.emit(`defeat:${String(event.entityId)}`);
		} else if (event.type === "STATUS_APPLIED") {
			animationBus.emit(`statusPop:${String(event.targetId)}`);
		} else if (event.type === "BUFF_APPLIED") {
			animationBus.emit(`buffPop:${String(event.targetId)}`);
		} else if (event.type === "TURN_START" || event.type === "TURN_END") {
			animationBus.emit("screenPulse");
		}

		const delay = FRAME_DELAY[animationSpeed] ?? FRAME_DELAY.normal;
		const handle = window.setTimeout(() => {
			consumeAnimationFrame(frame.tick);
		}, delay);

		return () => {
			clearTimeout(handle);
			if (processingTickRef.current === frame.tick) {
				processingTickRef.current = null;
			}
		};
	}, [frame, animationSpeed, consumeAnimationFrame, clearAnimationQueue, spawnNumber]);

	return null;
}
