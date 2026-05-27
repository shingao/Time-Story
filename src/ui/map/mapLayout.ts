// ---------------------------------------------------------------------------
// Map layout constants and pure geometry helpers
// ---------------------------------------------------------------------------

export const HEADER_HEIGHT = 72; // px
export const MAP_PADDING_X = 44; // px horizontal
export const MAP_PADDING_Y = 64; // px top/bottom
export const NODE_SIZE = 56; // diameter px
export const FLOOR_HEIGHT = 88; // px between floor centers
export const NUM_FLOORS = 16;

/**
 * Total pixel height of the scrollable map content.
 */
export function totalMapHeight(): number {
	return MAP_PADDING_Y * 2 + (NUM_FLOORS - 1) * FLOOR_HEIGHT;
}

/**
 * Horizontal center of a node given its column index, total columns, and
 * the viewport width in pixels.
 */
export function nodeX(column: number, numColumns: number, viewportWidth: number): number {
	const usable = viewportWidth - 2 * MAP_PADDING_X;
	return MAP_PADDING_X + column * (usable / (numColumns - 1));
}

/**
 * Vertical center of a node given its floor.
 * Floor 0 is at the bottom, floor 15 at the top.
 */
export function nodeY(floor: number): number {
	// floor 0 at bottom, floor 15 at top
	return MAP_PADDING_Y + (NUM_FLOORS - 1 - floor) * FLOOR_HEIGHT;
}

/**
 * Computes the ideal scroll offset (translateY) to centre the given floor
 * 70% down the viewport.
 * Returns a value in (-mapHeight + viewportHeight, 0].
 */
export function computeScrollTarget(currentFloor: number, viewportHeight: number): number {
	const mapH = totalMapHeight();
	const floorCenterY = nodeY(currentFloor) + NODE_SIZE / 2;
	const raw = viewportHeight * 0.7 - floorCenterY;
	const min = -(mapH - viewportHeight);
	return Math.max(min, Math.min(0, raw));
}
