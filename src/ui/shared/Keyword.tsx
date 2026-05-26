import { useState } from "react";
import { KEYWORD_DEFINITIONS, parseKeywords } from "./keywordDefinitions.ts";

interface KeywordChipProps {
	readonly word: string;
}

function KeywordChip({ word }: KeywordChipProps) {
	const [visible, setVisible] = useState(false);
	const def = KEYWORD_DEFINITIONS.get(word.toLowerCase());

	if (!def) return <>{word}</>;

	return (
		<span className="relative inline-block">
			<button
				type="button"
				className="cursor-help font-bold text-yellow-300 underline decoration-dotted"
				onMouseEnter={() => setVisible(true)}
				onMouseLeave={() => setVisible(false)}
				onFocus={() => setVisible(true)}
				onBlur={() => setVisible(false)}
				aria-label={`${word}: ${def.description}`}
				style={{ background: "none", border: "none", padding: 0, font: "inherit" }}
			>
				{word}
			</button>
			{visible && (
				<span
					className="absolute bottom-full left-1/2 z-50 mb-1 w-48 -translate-x-1/2 rounded-md px-2 py-1.5 text-[10px] text-white shadow-lg"
					style={{ background: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.2)" }}
				>
					<span className="block font-bold text-yellow-300">{def.name}</span>
					{def.description}
				</span>
			)}
		</span>
	);
}

interface KeywordTextProps {
	readonly text: string;
}

export function KeywordText({ text }: KeywordTextProps) {
	const segments = parseKeywords(text);
	return (
		<>
			{segments.map((seg, i) =>
				seg.kind === "keyword" ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: static segments, no reorder
					<KeywordChip key={i} word={seg.content} />
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: static segments, no reorder
					<span key={i}>{seg.content}</span>
				),
			)}
		</>
	);
}
