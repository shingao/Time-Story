import type { Buff, Status } from "@core/combat/entity.ts";

const STATUS_ICONS: Record<string, string> = {
	burn: "🔥",
	poison: "☠️",
	doubt: "💭",
};

const BUFF_ICONS: Record<string, string> = {
	strength: "💪",
	focus: "🎯",
};

interface StatusIconsProps {
	readonly statuses: readonly Status[];
	readonly buffs: readonly Buff[];
}

export function StatusIcons({ statuses, buffs }: StatusIconsProps) {
	if (statuses.length === 0 && buffs.length === 0) return null;

	return (
		<ul className="flex flex-wrap gap-1" aria-label="Status effects">
			{statuses.map((s) => (
				<li
					key={String(s.id)}
					title={`${String(s.id)}: ${s.stacks} stack${s.stacks !== 1 ? "s" : ""}`}
					className="flex items-center gap-0.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white"
				>
					<span aria-hidden>{STATUS_ICONS[String(s.id)] ?? "✦"}</span>
					<span>{s.stacks}</span>
				</li>
			))}
			{buffs.map((b) => (
				<li
					key={String(b.id)}
					title={`${String(b.id)}: ${b.stacks} stack${b.stacks !== 1 ? "s" : ""}`}
					className="flex items-center gap-0.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-yellow-300"
				>
					<span aria-hidden>{BUFF_ICONS[String(b.id)] ?? "⬆️"}</span>
					<span>{b.stacks}</span>
				</li>
			))}
		</ul>
	);
}
