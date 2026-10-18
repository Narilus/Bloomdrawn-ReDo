# Handover — Bloomdrawn (Claude restart)

From the planning session of 18 Oct 2026 (cloud chat, no repo) to the first build session on the owner's CachyOS machine. Read this once. After it, CLAUDE.md, PLAN.md and DECISIONS.md are the working files, and this file is history.

## Who and what

- **Owner:** William Blight (GitHub: Narilus). He signs off design and anything subjective, especially feel. He knows the game well and corrects drift quickly. Ask when a design question is genuinely open. Don't invent answers to fill gaps.
- **Game:** Bloomdrawn is a party-driven roguelike deckbuilder with a full RPG gacha layer and **no monetisation**. The main reference is Morimens. The setting is a flesh-flower from space (Annihilation's Shimmer as reference).
- **This attempt:** a clean restart, built by Claude as one continuous builder. The owner is explicitly benchmarking this against earlier orchestrators (GPT 5.4–5.6 / "Sol"). Those runs failed by overengineering tests, workflows and audit loops. Winning the benchmark means a playable game that grows steadily. It does not mean more process.

## Source-of-truth order

1. `docs/DESIGN.md`: what the game is. It wins every conflict.
2. `docs/ARCHITECTURE.md`: how it is built.
3. `DECISIONS.md`: why, and when it changed.
4. `PLAN.md`: what is happening now.

The docs began as Claude Docs (links below). **From the first commit, the repo copies are canonical.** Edit them in the repo, in the same commit as the change they describe. The Claude Docs versions are frozen drafts.

- Design Document v0.1: https://claude.ai/code/artifact/7f39bdcb-d5e4-4ee2-af97-b5e114beb49c
- Technical Architecture v0.1: https://claude.ai/code/artifact/d32a9cce-ae63-4c84-b97c-551fb3c1e0ed
- Combat concept canvas (v1, pre-feedback): https://claude.ai/artifact/SLPsyFDrVhpyG2uKs2FN6s

## History: three previous attempts, kept as lessons

| Repo | What happened | Lesson |
|---|---|---|
| **Narilus/Gloomdrawn** (May–Jun 2026) | Loosely planned vertical slices: React + Phaser 4 + Motion. It got the furthest: real art, idle breathing, lunges, card hand feel, hex run map. | Presentation and feel came from building and playing, not from planning. It also had some hardcoding (roster lists, static per-card imports). |
| **Narilus/Bloomdrawn** (TS, Jun–Jul) | Strong architecture: deterministic engine, named RNG streams, schema-validated content, generic operations. It stalled at M3 in a perpetually failing audit loop, after about two weeks of "hardening" and quality-gate adapters. | Hardening needs a stopping point. Fix real bugs found by tests or play. Never run open-ended audits. |
| **Narilus/Bloomdrawn-Unity** (Jul–Aug) | Tested Unity CLI. M0 and M1 took one day, then two weeks went to drag-acceptance harnesses, SHA-256 test locks and role pipelines, trying to make an agent prove card feel. The coder also kept re-making the same editor mistakes after fixes. | An agent cannot prove feel; the owner plays it. A mistake fixed once must be written down so it isn't made again (see "Known traps" in CLAUDE.md). |

More cautions:

- The old `DESIGN.md` files were **altered by agents** and contain wrong numbers (Mana, cost bands and more). Use the old repos for code ideas only. Never use them for rules or numbers. `docs/DESIGN.md` here replaces them.
- The old art notes were full of undrawable prose ("fractals that shimmer in echoes"). The art rules in DESIGN.md exist to prevent that.
- Earlier cheap-model delegation went badly: GLM 5.2 rewrote tests to force passes. Delegation is a later option and must be mechanically blocked from editing tests.

## Decisions made with the owner in the planning session

The full list is in `DECISIONS.md`. The ones most likely to be gotten wrong:

- **Mana and costs:** 6 base Mana. Strike 1, Defense 1, Transcend 3–5, Flavour A/B 2–5. Hand 5, max 10.
- **Ultimates:** gauges persist across the whole run. **Transcend** is once per combat, and its upgrade lasts that combat only.
- **Domains:** Flesh (Caro), Rapture (Aequor; formerly Abyss), Spirit (original), Unbound (Chaos; formerly Void). Rapture is Lovecraftian cult devotion and **never aquatic**. Unbound is **never cosmic**. Bloom theming is looser for Spirit and Unbound (a kyubi can stay a kyubi).
- **Map:** free-roaming hex board-game Labyrinth with fog of war. The **Bloom clock ticks only on fights, Events and Camp use**, never on walking, Shops or Symptoms. Camps and Symptoms are one-use. Collapsing tiles can never strand the player.
- **Gacha:** SSR 3% / SR 15% / R 82%; hard pity at 30; **no soft pity**; 50/50 with at most two losses (worst case 30/60/90); ten-pull guarantees SR+.
- **The RPG meta layer stays:** levels, EXP bank, ascension, skill levels (numbers only), dupes, weapons, depth tiers. Gear is probably a later phase.
- **Combat screen:**
  - Party sits on a diagonal from bottom-left (front) to top-right (back), drawn front-last so no one is hidden.
  - Relics go top centre. The Bloom clock is shown on the map only, not in combat.
  - Enemies are on the right.
- **Art:**
  - "Pastel subjects on dusk grounds."
  - Domain names never go in image prompts.
  - Respect the banned-word list and the never-list.
  - Use the prompt stem from DESIGN.md.

## Stack (decided, don't reopen without the owner)

- TypeScript strict throughout. The pure rules engine has no framework, no browser APIs, no `Math.random` and no `Date`.
- Content is Zod-validated typed TS data, kept JSON-shaped.
- React for UI and input, Motion for all animation (including Pixi properties via `animate()`), and PixiJS v8 mounted directly in a React component.
- Vite as a single package, with an import-boundary lint rule.
- Vitest for rules; Playwright for smoke tests and screenshots only.
- Saves are versioned JSON in IndexedDB via idb-keyval. Tauri or Electron is decided later.

The owner asked for "what gives the best result" and accepted PixiJS over Phaser. The M0 spike tests **feel**, not that choice.

## Environment

- **Machine:** CachyOS (Arch). Claude Code is installed with the native installer. Node 26.x is the system Node (the owner kept `nodejs` 26 over `nodejs-lts`). Check `node -v` before scaffolding and pin an engines field.
- **Windows 11** is available later for desktop-wrapper testing.
- **No Claude desktop app** (it is unsupported on Arch). The owner talks to you in Claude Code.
- **Repo:** https://github.com/Narilus/Bloomdrawn-ReDo (created empty; the new session initialises it with this bundle as the first commit).
- **Image generation:** Claude has none natively. The plan:
  - The owner installs the **Codex CLI** with his ChatGPT login.
  - Claude runs `codex exec` with an image prompt (Codex's built-in image tool), saves the outputs and reviews them against the brief.
  - Verify on first use that the image tool is available to `codex exec` in his setup.
  - For bulk work later, an OpenAI API key and a small script.
  - Every prompt is the stem from DESIGN.md plus a concrete brief, with no Domain names.

## Reference files in this bundle

- `reference/concepts/`: four OpenAI concepts (garden combat, labyrinth map, Bloom Lash card, Pale Matron boss) set **mood and rendering only**. Their UI layouts and names are not design. `temptation-loop-owner-diagram.png` is the owner's sketch of the canonical loop motif.
- `reference/legacy-sprites/`: Gloomdrawn battle sprites and portraits for Maelia, Virelle and Kibane, usable as placeholder art for the M0 spike. Kibane's dragon horns go in the real redraw. Leonora and Agathe have no art yet, and enemy art in Gloomdrawn was SVG placeholders only.
- `reference/mockup/combat-mockup.html` (it loads Google Fonts) and its screenshot are the **v1** concept, made before the owner's feedback. Superseded points:
  - The party order and z-order are reversed: it should run bottom-left (front) to top-right (back), drawn front-last.
  - The Bloom clock panel becomes the relics bar.
  - The palette moved to dusk grounds.

  The card frame, hand fan, portrait strip and HUD placement are still a fair start.

## Open design items (settle before the milestone that needs them)

- Gear: launch or later (recommendation: design now, ship later).
- Bloom clock: ticks per stage and the exact effects of each stage. Does Camp use tick it? (Lean: yes.)
- Power-band table per depth tier; reward economy.
- Final names for Anthe and Hester; Shiori's place; final names for Obols, pulls and currencies.
- Content warnings and intensity settings; the desktop wrapper.

## First session

1. Read CLAUDE.md, then PLAN.md. Skim DESIGN.md and ARCHITECTURE.md fully once.
2. Confirm the Node version, then initialise https://github.com/Narilus/Bloomdrawn-ReDo with this bundle as the first commit.
3. Start M0 task 1 in PLAN.md. Narrate briefly; ship small commits; keep `npm run check` green.
