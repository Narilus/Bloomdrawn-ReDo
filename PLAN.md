# PLAN

**Current milestone:** M0 Foundation
**Current task:** M0.2 Engine core

## Milestones

Each milestone ends with the owner playing the build. **Bold** milestones are gates: nothing is built on top of them until he signs off.

| | Milestone | Scope |
|---|---|---|
| M0 | Foundation | Scaffold, engine skeleton, seeded RNG, save interface; PixiJS + Motion feel spike |
| **M1** | **First fight** | Starter four vs one enemy: full turn loop, all four Domain engines, drag/click/keys hand. Owner signs off feel |
| M2 | Combat breadth | Enemy tiers and roles, launch statuses, Transcend, run-persistent ultimates, first relics |
| M3 | The Labyrinth | Hex tiles, motifs and validator, temptation loop, fog, Bloom clock, Shops, Camps, Symptoms |
| **M4** | **First winnable run** | Rewards, Boss, banking, save and resume. Owner wins, quits and resumes a full run |
| M5 | Collection | Profile, levels, EXP bank, ascension, gacha and dupes; the four banner characters |
| M6 | Depth and polish | Weapons, Trials, depth tiers, art pass, audio, accessibility, balance |
| Later | | Gear, desktop packaging, more characters, authoring tool |

## M0 tasks

### M0.1 Scaffold ✅
Vite + React + TypeScript (strict) in one package, with the folder layout from ARCHITECTURE.md (`src/engine`, `src/game`, `src/content`, `src/stage`, `src/app`, `src/save`, `tools/lab`). Set up ESLint with an import-boundary rule, Vitest, and Playwright using the system Chromium. Add the scripts `dev`, `build`, `check`, `e2e`, and an `engines` field matching the installed Node.
**Done when:**
- `npm run check` passes.
- A deliberate `src/engine` → `src/app` import fails lint. Prove it once, then remove it.
- `npm run e2e` boots the app and takes one screenshot.

_Done 18 Oct. No system Chromium is installed, so Playwright uses its own Chromium from `npx playwright install chromium`. TypeScript is pinned to 6.0 because typescript-eslint doesn't support 7 yet._

### M0.2 Engine core
- State types.
- `apply(state, command, registry)` returning new state plus ordered events, or a rejection.
- A FIFO resolution queue, and trigger dispatch with the fixed order from ARCHITECTURE.md.
- Chain depth cap of 8, and no self re-fire.
- A small seeded PRNG with named streams stored in state.

**Done when** tests prove:
- the same seed and commands give identical events and state;
- a draw on one stream never shifts another;
- a rejected command leaves state deeply equal;
- a deliberately looping fixture trigger stops at depth 8 with a log event.

### M0.3 First operations and content
- Operations: `damage`, `gainShield`, `draw`, `gainResource`, and `ifConsume`, each with validate, resolve, preview and describe.
- A modifier pipeline covering at least flat-outgoing and the Shield steps.
- Formula trees.
- A Zod-validated registry with cross-checks.
- Fixture content: a training dummy, plus Strike and Defense for the starter four (placeholder numbers).

**Done when:**
- A `scenario(...)` test plays Strike into the dummy and its preview equals the result.
- A card pointing at a missing status fails registry validation with the file and ID.
- `ifConsume` spends nothing when its branch can't resolve.

### M0.4 Save interface
Versioned save envelope (schema and content version). Two adapters: idb-keyval and in-memory for tests. Keep the previous good save. Export/import as a JSON file.
**Done when:**
- A round-trip test passes.
- A simulated failed write leaves the last good save readable.
- A v0→v1 migration fixture passes.

### M0.5 Feel spike (owner gate for M0)
- The PixiJS v8 stage mounted in React, at 1920×1080 logical size and scaled to fit.
- Party of four on the SW→NE diagonal, drawn front-last, using Gloomdrawn sprites from `reference/legacy-sprites/` and silhouettes where art is missing. Three placeholder enemies on the right.
- Idle breathing offset per actor.
- Lunge-from-home with cancel-and-restart, plus target recoil and a damage number, all driven by Motion.
- React hand fan:
  - hover raises a card;
  - drag past the play line arms it;
  - release casts it, or picks a target for single-target cards;
  - drag back, Escape or right-click cancels;
  - number keys select and Enter confirms.
- Wired to the real engine for Strike and Defense.

**Done when:**
- The owner plays it and says the hand and lunges feel at least as good as Gloomdrawn.
- One small Playwright check confirms that after 20 rapid plays every actor settles back at its home point.

### M0.6 Art pipeline (parallel, owner-paced)
Owner installs the Codex CLI. Then confirm `codex exec` can generate an image from the prompt stem. Write briefs for the starter four (Maelia, Agathe, Anthe, Leonora) from DESIGN.md, generate 2–3 options each into `art/raw/<character>/`, and keep the prompt text beside each.
**Done when:** the owner has picked a direction for each starter, or has given notes for a second pass.

## Notes
- Numbers in fixture content are placeholders; tuning happens in M1–M2 with the owner.
- Open design items are listed in HANDOVER.md. Settle each with the owner before the milestone that needs it.
