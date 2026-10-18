# Bloomdrawn — working rules

A no-monetisation roguelike deckbuilding gacha. One builder (you), one owner (William), who plays every milestone and signs off feel.

## Read first
- `PLAN.md`: current milestone and task, with "done when" lines. Update it as tasks finish.
- `docs/DESIGN.md`: what the game is. It wins every conflict.
- `docs/ARCHITECTURE.md`: how it is built.
- `DECISIONS.md`: append-only log. Add a line whenever the owner decides something.
- `HANDOVER.md`: one-time background on why things are this way.

If code and docs disagree, fix whichever is wrong in the same commit. Don't create other planning documents. A one-page note in `docs/notes/` is allowed only for a task with real unknowns.

## Commands
- `npm run dev`: run the game.
- `npm run check`: typecheck, lint, unit tests. It must be green before every commit.
- `npm run e2e`: Playwright smoke tests and screenshots. Run it before milestone hand-off.

## Code rules
- `src/engine` is pure. No imports from game/content/stage/app, no DOM, no `Math.random`, no `Date`. Randomness comes only from named seeded streams in state.
- The engine never branches on content IDs or character names. Behaviour lives in operations; content is data.
- The UI never calculates damage, costs, targets or rewards. It shows engine previews.
- State is plain JSON. Saves store IDs, never objects.
- Prefer the simplest thing that works. No speculative abstractions, no frameworks-within-the-framework.

## Tests
- Tests prove rules: operations, kit scenarios, invariants, golden replays, content validation.
- **Never weaken, skip or delete a test to make it pass.** If a test is wrong, fix it deliberately and say why in the commit message.
- No acceptance harnesses, checksum locks, audit loops or agent-run "feel" tests. Playwright is for boots, layout and screenshots, and stays small.
- Hardening is bounded: fix bugs that tests or play actually found.

## Feel
Only the owner can sign off feel. When something feels-related is ready, give him the exact command and what to try ("drag a card past the line, cancel with right-click, spam Strike 10×"). Then wait for his verdict. Don't iterate on feel alone in a loop.

## Art and writing
- Every art note is drawable: a concrete noun, a material, a body part or prop, and a colour.
- Image prompts are the prompt stem from DESIGN.md plus the brief. **Domain names never appear in prompts.**
- **Banned words:** shimmer, fractal, echo, refraction, mirror, liminal, cosmic, ethereal, impossible geometry, pressure, "wrongness", otherworldly.
- Never in images: starfields, underwater scenes, crystal sparkle, neon, glitch effects, text.
- Images come from `codex exec` (owner's ChatGPT login). Save outputs to `art/raw/`, keep the prompt beside each image, and the owner picks.

## Working style
- Small commits that each leave the game building and playable. Push when green.
- When stuck on the same error twice, stop. Write down what you tried and ask, rather than looping.
- When you discover a mistake you or a previous agent keep making, add it to **Known traps** below so it isn't repeated.
- Ask the owner about open design questions. Don't invent rules, and don't revive numbers from the old repos.

## Known traps
- The old repos' DESIGN.md files were altered by agents and their numbers are wrong. Use `docs/DESIGN.md`.
- Rapture is never aquatic (no fish, fins, scales, coral). Unbound is never cosmic.
- Battlefield lunges always start from the actor's fixed home point, and a new lunge cancels the one in flight. Otherwise rapid play drifts sprites.
- The hand fan is recomputed from hand order on every change, never offset incrementally.
