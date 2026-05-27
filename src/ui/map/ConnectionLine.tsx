import { memo, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LineState = "available" | "visited" | "locked";

interface ConnectionLineProps {
	readonly x1: number;
	readonly y1: number;
	readonly x2: number;
	readonly y2: number;
	readonly lineState: LineState;
}

// ---------------------------------------------------------------------------
// CSS keyframe injection (once per page)
// ---------------------------------------------------------------------------

let _styleInjected = false;

function ensureDashFlowStyle() {
	if (_styleInjected || typeof document === "undefined") return;
	_styleInjected = true;
	const style = document.createElement("style");
	style.textContent = `
@keyframes pmd-dash-flow {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -28; }
}
`;
	document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ConnectionLine = memo(function ConnectionLine({
	x1,
	y1,
	x2,
	y2,
	lineState,
}: ConnectionLineProps) {
	useEffect(() => {
		ensureDashFlowStyle();
	}, []);

	// Cubic bezier control points
	const cx1 = x1 + (x2 - x1) * 0.1;
	const cy1 = y1 + (y2 - y1) * 0.4;
	const cx2 = x1 + (x2 - x1) * 0.9;
	const cy2 = y1 + (y2 - y1) * 0.6;
	const d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

	if (lineState === "available") {
		return (
			<path
				d={d}
				fill="none"
				stroke="#eab308"
				strokeWidth={2.5}
				strokeDasharray="8 6"
				style={{ animation: "pmd-dash-flow 1.5s linear infinite" }}
			/>
		);
	}

	if (lineState === "visited") {
		return <path d={d} fill="none" stroke="#22c55e80" strokeWidth={2} />;
	}

	// locked
	return <path d={d} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />;
});
