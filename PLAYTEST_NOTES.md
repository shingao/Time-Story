# Playtest Notes

## Session: May 2026

### Card UI Feedback

**Drag-and-drop preferred over click-select-click**
The current click-to-select → click-enemy flow works, but drag-and-drop feels more natural and
satisfying. Phase 3.3 added the click flow; drag-and-drop support was added in the same pass
(drag card onto enemy blob to play).

### Enemy Behaviour

**Enemy sometimes skipped attack ("unknown" intent)**
Observed once or twice that an enemy stood still for a turn without attacking. Most likely cause:
`rollIntent` wasn't being called at combat init, so the first-turn intent was `null`/`"unknown"`.
Investigate the `initCombat → beginPlayerTurn → rollIntent` ordering in `useCombatStore.ts`.

**Attack pattern scaling requested**
Enemies should feel progressively harder. Desired direction:
- Common enemies (Pidgey, Caterpie): low damage / low HP
- Mid-tier enemies (Mankey, Beedrill workers): moderate damage, 1-2 special moves
- Elites / Boss Beedrill: high damage, multi-hit, status effects (Poison, Doubt)
- Concrete numbers TBD when enemy JSON is balanced (Phase 3.1 data is placeholder)

### To-Do (from playtest)

- [ ] Investigate first-turn intent bug (enemy shows "unknown" on turn 1)
- [ ] Tune enemy HP and damage values per tier
- [ ] Add Beedrill elite attack pattern (Fury Attack × 2-4 hits, Twineedle Poison chance)
- [ ] Consider energy-gain relics to make longer combats more dynamic
