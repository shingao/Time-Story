import { CARD_REGISTRY } from "@core/cards/card-registry.ts";
import { CardFrame } from "@ui/cards/CardFrame.tsx";

export function CardGallery() {
	const cards = Array.from(CARD_REGISTRY.values());

	return (
		<div
			className="min-h-screen px-8 py-10"
			style={{ fontFamily: "var(--font-pmd)", background: "var(--color-dungeon-bg)" }}
		>
			<div className="mb-8 flex items-baseline gap-4">
				<h1 className="font-bold text-2xl text-white">Card Gallery</h1>
				<span className="text-sm text-white/40">{cards.length} cards</span>
				<a
					href="#/"
					className="ml-auto text-xs text-white/40 underline decoration-dotted hover:text-white/70"
				>
					← Back to dev menu
				</a>
			</div>

			<div className="flex flex-wrap gap-4">
				{cards.map((def) => (
					<CardFrame key={def.id} definition={def} size="md" />
				))}
			</div>
		</div>
	);
}
