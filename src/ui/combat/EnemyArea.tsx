import type { Enemy } from "@core/combat/entity.ts";
import { EnemySprite } from "./EnemySprite.tsx";

interface EnemyAreaProps {
	readonly enemies: readonly Enemy[];
	readonly targetingActive: boolean;
	readonly onEnemyClick: (enemyId: string) => void;
}

export function EnemyArea({ enemies, targetingActive, onEnemyClick }: EnemyAreaProps) {
	const living = enemies.filter((e) => e.hp > 0);

	return (
		<section
			className="flex flex-1 items-center justify-center gap-12 px-8 py-4"
			aria-label="Enemy area"
			style={{
				background: targetingActive ? "rgba(255,255,255,0.04)" : "transparent",
				transition: "background 0.2s",
				outline: targetingActive ? "2px dashed rgba(255,255,255,0.3)" : "none",
				borderRadius: 16,
			}}
		>
			{living.length === 0 ? (
				<p className="text-white/40 text-sm">No enemies remain</p>
			) : (
				living.map((enemy) => (
					<EnemySprite
						key={String(enemy.id)}
						enemy={enemy}
						isTargeted={targetingActive}
						onClick={() => onEnemyClick(String(enemy.id))}
					/>
				))
			)}
		</section>
	);
}
