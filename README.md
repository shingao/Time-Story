# Pokémon Mystery Spire

A roguelike deckbuilder fan game combining **Slay the Spire**'s deckbuilding mechanics with the atmosphere, narrative, and world of **Pokémon Mystery Dungeon: Explorers of Sky**.

> ⚠️ **Fan Project Notice**: PMD sprites, music, and sound effects are © Nintendo / Spike Chunsoft. This is a non-commercial fan work for personal/educational use only. Not affiliated with or endorsed by Nintendo or Spike Chunsoft.

---

## Setup

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test` | Run tests (watch mode) |
| `npm run test:run` | Run tests (CI mode) |
| `npm run test:coverage` | Coverage report |
| `npm run check` | Biome lint + format (auto-fix) |
| `npm run typecheck` | TypeScript type check |

## Tech Stack

- **Vite 8** + **React 19** + **TypeScript 6** (strict)
- **Tailwind CSS 4** (PMD-inspired theme)
- **Zustand 5** (state management)
- **Phaser 3.90** (combat visuals — cosmetic only)
- **Framer Motion 12** (card animations)
- **Howler 2** (audio)
- **Zod 4** (data validation)
- **Vitest 4** + **@testing-library/react** (testing)
- **Biome 2** (linting + formatting)

## Project Structure

```
src/
├── core/       # Pure game logic (no React, no Phaser)
├── game/       # Phaser scenes & sprites (cosmetic only)
├── ui/         # React components
├── state/      # Zustand stores
├── data/       # JSON card/enemy/relic/event definitions
├── assets/     # sprites, audio, fonts
├── narrative/  # dialogue manager, partner system
└── audio/      # Howler-based audio manager
```

See `CLAUDE.md` for full conventions and architecture documentation.
