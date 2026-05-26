# CLAUDE.md — Pokémon Mystery Spire

> **Read this file at the start of EVERY session before writing any code.**
> This is the canonical source of truth for project conventions. If anything here conflicts with a user request, ask for clarification before proceeding.

---

## 🎮 Project Overview

**Pokémon Mystery Spire** is a roguelike deckbuilder fan game that combines:
- **Slay the Spire**'s gameplay (deckbuilding, branching map, relics, run-based progression)
- **Pokémon Mystery Dungeon: Explorers of Sky**'s atmosphere, narrative, sprites, music
- Original mechanics: Pokémon type system, evolution-triggered card transformations, hidden Time Gear objective, Wigglytuff's Guild as hub

**Target platform**: Web browser (desktop first, mobile-friendly later).
**Audience**: Personal/fan project. Not for commercial distribution (uses copyrighted PMD assets).
**Scope (MVP)**: 2 starters (Charmander, Treecko), 1 act, ~25 cards/starter, 15 enemies, 15 relics, 6 events, 1 boss.

---

## 🛠️ Tech Stack (locked — do not deviate without asking)

| Layer | Tech | Installed Version | Notes |
|---|---|---|---|
| Build tool | Vite | 8+ | Strict TS, path aliases |
| Language | TypeScript | 6+ | `strict: true`, `noUncheckedIndexedAccess: true` |
| UI framework | React | 19+ | Functional components only, no class components |
| Game engine (combat visuals only) | Phaser | 3.90+ | Cosmetic layer — never owns game state |
| State management | Zustand | 5+ | With `persist` middleware + versioning |
| Styling | Tailwind CSS | 4+ | `@tailwindcss/vite` plugin, `@theme` in CSS |
| Animation | Framer Motion | 12+ | For React UI (cards, modals, transitions) |
| Audio | Howler.js | 2+ | Music + SFX with volume controls |
| Validation | Zod | 4+ | All JSON content validated at load time |
| Testing | Vitest + @testing-library/react | 4+ | jsdom environment |
| Linting/formatting | Biome | 2+ | Replaces ESLint + Prettier |

**Forbidden** unless explicitly authorized: Redux, MobX, Next.js, Emotion/Styled-Components, Jest, ESLint, Prettier, class components, default exports (use named exports), `any` type, `Math.random()` in `core/`.

---

## 📁 Folder Structure & Rules

```
src/
├── core/         # Pure game logic. ZERO React, ZERO Phaser, ZERO browser APIs.
│   ├── cards/
│   ├── combat/
│   │   └── effects/
│   ├── dungeon/
│   ├── enemies/
│   ├── events/
│   ├── relics/
│   ├── rng/
│   └── types/
├── game/         # Phaser scenes & sprite logic (cosmetic only)
│   ├── scenes/
│   └── sprites/
├── ui/           # React components
│   ├── cards/
│   ├── dungeon/
│   ├── hub/
│   ├── scenes/
│   └── shared/
├── state/        # Zustand stores (useRunStore, useCombatStore, useMetaStore, useUIStore)
├── data/         # JSON content (cards, relics, enemies, events, dialogue)
│   ├── cards/
│   ├── enemies/
│   ├── events/
│   └── relics/
├── assets/       # sprites/, audio/, fonts/
├── narrative/    # Dialogue manager, partner system
└── audio/        # Howler-based audio manager
tests/            # Integration tests (unit tests live next to source as *.test.ts)
```

### Inviolable rules
1. **`core/` is pure.** It imports only from itself and from `npm` packages with no DOM dependency. If you find yourself importing React, Phaser, `window`, or `document` in `core/`, you're doing it wrong.
2. **Phaser is cosmetic.** Game state lives in Zustand/`core/`. Phaser renders it. React→Phaser communication uses an event bridge, never shared mutable state.
3. **Every file in `core/` has a sibling `.test.ts`.** No exceptions for "trivial" files.
4. **All randomness in `core/` flows through the seeded `Rng` instance.** `Math.random()` is banned — enforced by test and code review.
5. **All JSON data is Zod-validated at load.** Crash loudly at startup, not silently at runtime.
6. **No default exports.** Use named exports only — better refactoring, better tree-shaking, better discoverability.

---

## 🏷️ Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Files | `kebab-case.ts` | `damage-calculator.ts` |
| React components | `PascalCase.tsx` | `CardHand.tsx` |
| Types & interfaces | `PascalCase` | `CardDefinition`, `Combatant` |
| Functions | `camelCase` | `calculateDamage`, `drawCards` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_HAND_SIZE`, `TYPE_CHART` |
| Branded IDs | `PascalCaseId` | `CardId`, `EntityId`, `RelicId` |
| Booleans | `is/has/can/should` prefix | `isPlayable`, `hasReviver` |
| Event types | `SCREAMING_SNAKE_CASE` string | `'CARD_PLAYED'`, `'TURN_END'` |
| Zustand stores | `useXxxStore` | `useRunStore` |
| Test files | `<source>.test.ts` | `damage.test.ts` |

---

## 🧪 Testing Standards

- **Vitest** with `jsdom` environment.
- **Co-located**: `damage.ts` → `damage.test.ts` next to it.
- **Coverage expectation for `core/`**: aim for 90%+, every branch in damage calc / event bus / RNG covered.
- **Property-based tests** for non-trivial generators (map generation runs 1000 times, shuffle is statistically unbiased).
- **No mocks for pure functions.** If you need to mock `core/`, the design is wrong.
- **UI tests**: minimal, mostly smoke tests. Don't waste time testing pixel positions.
- **Integration test**: at least one "full combat" test simulating turns end-to-end through the event bus.

---

## 📐 Architectural Principles

### Data-driven over code-driven
Cards, relics, enemies, events are **declarative JSON/objects**, not functions. A separate executor interprets them. This enables:
- Serializable save states
- JSON-editable content
- Queryable content ("all cards that apply Burn")
- Future modding / multiplayer

### Event-driven combat
All combat actions emit events on a central bus. Effects (cards, relics, statuses, buffs) are **handlers** that subscribe to events. Two-phase damage (`DAMAGE_INTENDED` → `DAMAGE_DEALT`) lets reactive effects modify or cancel damage cleanly.

### Branded types for IDs

```ts
type CardId = string & { readonly __brand: 'CardId' };
type EntityId = string & { readonly __brand: 'EntityId' };
```

Prevents accidentally passing a card ID where an entity ID is expected.

### Seeded determinism
Single `Rng` instance per run, seeded once at run start. Same seed = identical run (maps, draws, drops). Required for daily challenges, debugging, save/load fidelity.

### Versioned persistence
Zustand `persist` middleware with explicit `version` and `migrate` function. When schemas change, old saves migrate, never crash.

---

## ⚙️ Path Aliases

All aliases resolve from `src/`:

| Alias | Maps to |
|---|---|
| `@core/*` | `src/core/*` |
| `@ui/*` | `src/ui/*` |
| `@state/*` | `src/state/*` |
| `@data/*` | `src/data/*` |
| `@game/*` | `src/game/*` |
| `@assets/*` | `src/assets/*` |
| `@narrative/*` | `src/narrative/*` |
| `@audio/*` | `src/audio/*` |

Configured in both `tsconfig.app.json` (paths) and `vite.config.ts` (resolve.alias).

---

## ⚠️ Common Pitfalls (already avoided by following this guide)

- ❌ Hardcoding card effects in combat logic → ✅ Data-driven effect handlers
- ❌ TypeScript enums → ✅ String literal unions (tree-shakable)
- ❌ `Math.random()` anywhere in `core/` → ✅ Seeded `Rng` only
- ❌ Phaser owning game state → ✅ Zustand owns state, Phaser renders
- ❌ Mutating arrays/objects in reducers → ✅ Immutable updates (spread or immer)
- ❌ Missing Zod validation on JSON → ✅ Validate at load, crash loud
- ❌ No versioning on persisted state → ✅ Always include `version` + `migrate`
- ❌ Coupled React + Phaser via shared refs → ✅ Event bridge pattern
- ❌ Forgetting to test reshuffle / empty pile edge cases → ✅ Test those FIRST
- ❌ Default exports → ✅ Named exports only (Biome rule `noDefaultExport` enforced)

---

## 📦 Commit Conventions

Use **Conventional Commits**:
- `feat: add Burn status handler`
- `fix: reshuffle when draw pile empty and discard non-empty`
- `refactor: extract damage calculation into pure function`
- `test: add type effectiveness exhaustive matchups`
- `chore: bump phaser to 3.90.0`
- `docs: update CLAUDE.md with relic conventions`

**One feature per commit.** No "WIP" merges to main.

---

## 🎨 PMD Atmospheric Guidelines

- **Color palette**: warm earth tones (guild interior), cool blues/purples (dungeons), sinister reds/violets (corrupted/Distortion).
- **Typography**: rounded sans-serif evoking the PMD UI feel. Avoid hard angular fonts. Font variable: `var(--font-pmd)`.
- **Tone of dialogue**: heartfelt, occasionally melancholic, never grimdark. PMD Explorers of Sky vibes.
- **Pacing**: combat is brisk (animations <500ms by default, configurable). Cutscenes/dialogue: paced, with breathing room.
- **Music transitions**: 2s crossfade between scenes. Never abrupt cuts.

---

## 🧭 Session Workflow

When starting a new session with Claude Code:
1. **Read this file first.**
2. Confirm the current phase (check `git log` or the most recent commit message).
3. Re-read the relevant phase prompt before writing code.
4. Ask clarifying questions before making non-trivial architectural decisions.
5. After completing a prompt: run tests, run `biome check`, commit with a Conventional Commit message.
6. If conventions evolve, **update this file** in the same commit.

---

## 🚫 Asset & Legal Notice

PMD sprites, music, and SFX are © Nintendo / Spike Chunsoft. This project is a **non-commercial fan work** for personal/educational use only. The repository's README must include this disclaimer. Do not publish builds with copyrighted assets to commercial storefronts (Steam, etc.).

---

## 📞 When in Doubt

Ask the user. Don't guess on architecture, scope, or asset choices.
