import type { CardCategory, CardDefinition, CardRarity } from "@core/cards/card-definition.ts";
import { resolveCard } from "@core/cards/card-definition.ts";
import type { PokemonType } from "@core/types/pokemon-types.ts";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Colour lookup maps
// ---------------------------------------------------------------------------

const TYPE_COLOR: Record<PokemonType, string> = {
	normal: "var(--color-type-normal)",
	fire: "var(--color-type-fire)",
	water: "var(--color-type-water)",
	electric: "var(--color-type-electric)",
	grass: "var(--color-type-grass)",
	ice: "var(--color-type-ice)",
	fighting: "var(--color-type-fighting)",
	poison: "var(--color-type-poison)",
	ground: "var(--color-type-ground)",
	flying: "var(--color-type-flying)",
	psychic: "var(--color-type-psychic)",
	bug: "var(--color-type-bug)",
	rock: "var(--color-type-rock)",
	ghost: "var(--color-type-ghost)",
	dragon: "var(--color-type-dragon)",
	dark: "var(--color-type-dark)",
	steel: "var(--color-type-steel)",
	fairy: "var(--color-type-fairy)",
};

const CATEGORY_BG: Record<CardCategory, string> = {
	attack: "var(--color-card-attack)",
	skill: "var(--color-card-skill)",
	power: "var(--color-card-power)",
};

const RARITY_BORDER: Record<CardRarity, string> = {
	starter: "#9ca3af",
	common: "rgba(255,255,255,0.5)",
	uncommon: "#4ade80",
	rare: "#facc15",
};

const RARITY_GLYPH: Record<CardRarity, string> = {
	starter: "◆",
	common: "◆",
	uncommon: "◆◆",
	rare: "◆◆◆",
};

const RARITY_COLOR: Record<CardRarity, string> = {
	starter: "#9ca3af",
	common: "rgba(255,255,255,0.5)",
	uncommon: "#4ade80",
	rare: "#facc15",
};

// ---------------------------------------------------------------------------
// Sizing presets
// ---------------------------------------------------------------------------

export type CardSize = "sm" | "md" | "lg";

const SIZE_DIMS: Record<CardSize, { width: number; height: number; textBase: string }> = {
	sm: { width: 130, height: 190, textBase: "text-[10px]" },
	md: { width: 160, height: 230, textBase: "text-[12px]" },
	lg: { width: 200, height: 285, textBase: "text-[13px]" },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CardFrameProps {
	readonly definition: CardDefinition;
	readonly upgradeLevel?: 0 | 1 | 2;
	readonly isPlayable?: boolean;
	readonly isSelected?: boolean;
	readonly onClick?: () => void;
	readonly size?: CardSize;
	readonly style?: CSSProperties;
	readonly "data-testid"?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CardFrame({
	definition,
	upgradeLevel = 0,
	isPlayable = true,
	isSelected = false,
	onClick,
	size = "sm",
	style,
	"data-testid": testId,
}: CardFrameProps) {
	const resolved = resolveCard(definition, upgradeLevel);
	const primaryType = resolved.types[0];
	const { width, height, textBase } = SIZE_DIMS[size];

	const typeColor = TYPE_COLOR[primaryType];
	const categoryBg = CATEGORY_BG[resolved.category];
	const rarityBorder = RARITY_BORDER[resolved.rarity];
	const isUpgraded = upgradeLevel > 0;

	return (
		<motion.div
			data-testid={testId}
			onClick={isPlayable ? onClick : undefined}
			style={{
				width,
				height,
				borderColor: isSelected ? "#fff" : rarityBorder,
				boxShadow: isSelected
					? `0 0 16px 4px rgba(255,255,255,0.5), 0 4px 12px rgba(0,0,0,0.6)`
					: "0 4px 12px rgba(0,0,0,0.6)",
				opacity: isPlayable ? 1 : 0.45,
				cursor: isPlayable && onClick ? "pointer" : "default",
				fontFamily: "var(--font-pmd)",
				...style,
			}}
			className="relative flex flex-col overflow-hidden rounded-lg border-2 select-none"
			whileHover={isPlayable && onClick ? { scale: 1.06, y: -8 } : undefined}
			whileTap={isPlayable && onClick ? { scale: 0.97 } : undefined}
			transition={{ type: "spring", stiffness: 320, damping: 22 }}
		>
			{/* Header — cost + name */}
			<div className="flex items-center gap-1 px-2 py-1" style={{ background: categoryBg }}>
				{/* Energy cost bubble */}
				<span
					role="img"
					className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-300 font-bold text-black text-[11px] leading-none"
					aria-label={`Energy cost: ${resolved.energyCost}`}
				>
					{resolved.energyCost}
				</span>

				{/* Card name */}
				<span
					className={`flex-1 truncate font-bold text-white leading-tight ${size === "sm" ? "text-[11px]" : "text-[13px]"}`}
				>
					{resolved.name}
					{isUpgraded && <span className="ml-0.5 text-yellow-300">+</span>}
				</span>

				{/* Primary type badge */}
				<span
					role="img"
					className="shrink-0 rounded px-1 py-0.5 font-semibold text-[8px] uppercase leading-none text-white"
					style={{ backgroundColor: typeColor }}
					aria-label={`Type: ${primaryType}`}
				>
					{primaryType}
				</span>
			</div>

			{/* Art area — type gradient background */}
			<div
				className="flex flex-1 items-center justify-center"
				style={{
					background: `linear-gradient(160deg, ${categoryBg}cc 0%, ${typeColor}44 100%)`,
				}}
			>
				{/* Category icon placeholder — will be replaced with actual sprites */}
				<span className="text-white/30 text-3xl select-none" aria-hidden>
					{resolved.category === "attack" ? "⚔" : resolved.category === "skill" ? "🛡" : "✦"}
				</span>
			</div>

			{/* Description */}
			<div
				className={`px-2 py-1 ${textBase} leading-snug text-white/90`}
				style={{ background: "rgba(0,0,0,0.55)" }}
			>
				{resolved.description}
			</div>

			{/* Footer — rarity */}
			<div
				className="flex items-center justify-between px-2 py-0.5"
				style={{ background: "rgba(0,0,0,0.7)" }}
			>
				<span
					role="img"
					className="text-[9px] font-semibold tracking-wide uppercase"
					style={{ color: RARITY_COLOR[resolved.rarity] }}
					aria-label={`Rarity: ${resolved.rarity}`}
				>
					{RARITY_GLYPH[resolved.rarity]} {resolved.rarity}
				</span>
				{/* Second type badge if multi-type */}
				{resolved.types.length > 1 && resolved.types[1] && (
					<span
						className="rounded px-1 py-0.5 font-semibold text-[8px] uppercase leading-none text-white"
						style={{ backgroundColor: TYPE_COLOR[resolved.types[1]] }}
					>
						{resolved.types[1]}
					</span>
				)}
			</div>
		</motion.div>
	);
}
