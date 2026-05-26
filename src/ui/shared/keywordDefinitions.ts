export interface KeywordDefinition {
	readonly name: string;
	readonly description: string;
}

export const KEYWORD_DEFINITIONS: ReadonlyMap<string, KeywordDefinition> = new Map([
	[
		"burn",
		{
			name: "Burn",
			description:
				"At the start of your turn, take damage equal to Burn stacks, then Burn decays by 1.",
		},
	],
	[
		"poison",
		{
			name: "Poison",
			description:
				"At the start of each turn, take damage equal to Poison stacks, then Poison decays by 1.",
		},
	],
	[
		"strength",
		{
			name: "Strength",
			description: "Increases damage dealt by attack cards by this amount.",
		},
	],
	[
		"focus",
		{
			name: "Focus",
			description: "Increases the block gained from skill cards by this amount.",
		},
	],
	[
		"exhaust",
		{
			name: "Exhaust",
			description: "When played, this card is removed from your deck for the rest of combat.",
		},
	],
	[
		"block",
		{
			name: "Block",
			description: "Absorbs incoming damage before HP. Lost at the start of your turn.",
		},
	],
	[
		"doubt",
		{
			name: "Doubt",
			description: "Reduces the block gained from skill cards. Decays by 1 each turn.",
		},
	],
]);

/** Splits `text` into plain-text and keyword segments for rendering. */
export function parseKeywords(
	text: string,
): Array<{ readonly kind: "text" | "keyword"; readonly content: string }> {
	const keys = [...KEYWORD_DEFINITIONS.keys()].join("|");
	const pattern = new RegExp(`\\b(${keys})\\b`, "gi");
	const segments: Array<{ kind: "text" | "keyword"; content: string }> = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex idiom
	while ((match = pattern.exec(text)) !== null) {
		if (match.index > lastIndex) {
			segments.push({ kind: "text", content: text.slice(lastIndex, match.index) });
		}
		segments.push({ kind: "keyword", content: match[0] });
		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < text.length) {
		segments.push({ kind: "text", content: text.slice(lastIndex) });
	}

	return segments;
}
