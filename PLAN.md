# PLAN

**Current milestone:** M4 First winnable run (M3 signed off 23 Oct)
**Current task:** M4.2 The Boss

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

### M0.2 Engine core ✅
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

_Done 18 Oct. "No self re-fire" is implemented as: a trigger is skipped if its key is already in the chain's ancestry. Ops mutate a `structuredClone` draft; nested control-flow ops return `then` and run ahead of queued triggers._

### M0.3 First operations and content ✅
- Operations: `damage`, `gainShield`, `draw`, `gainResource`, and `ifConsume`, each with validate, resolve, preview and describe.
- A modifier pipeline covering at least flat-outgoing and the Shield steps.
- Formula trees.
- A Zod-validated registry with cross-checks.
- Fixture content: a training dummy, plus Strike and Defense for the starter four (placeholder numbers).

**Done when:**
- A `scenario(...)` test plays Strike into the dummy and its preview equals the result.
- A card pointing at a missing status fails registry validation with the file and ID.
- `ifConsume` spends nothing when its branch can't resolve.

_Done 18 Oct. Also added `applyStatus`, because the missing-status check needs an op that references a status. The registry is built by globbing content files, so errors carry the file path. Deferred to M1: the "exactly five personal cards per starter" cross-check, since starters only have Strike and Defense so far. Placeholder stats: HP 50, Attack 4, Defense 4; Strike 6 + Attack, Defense 5 + Defense; dummy 60 HP._

### M0.4 Save interface ✅
Versioned save envelope (schema and content version). Two adapters: idb-keyval and in-memory for tests. Keep the previous good save. Export/import as a JSON file.
**Done when:**
- A round-trip test passes.
- A simulated failed write leaves the last good save readable.
- A v0→v1 migration fixture passes.

_Done 18 Oct. Saves are stored as JSON text. A write checks that the new save reads back before storing it, and only copies `current` to `previous` if `current` is readable. The idb adapter was checked once in Chromium. Export and import are text in and out; the file buttons come with the first UI that needs them. Real save kinds (profile, run) are defined when their state exists._

### M0.5 Feel spike (owner gate for M0) ✅
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

_Signed off by the owner 18 Oct. The line-up is Maelia, Virelle and Kibane (the three Gloomdrawn sprites) plus Leonora as a silhouette, against three training dummies. Virelle and Kibane got placeholder Strike/Defense for this. The settle check passes, and it fails when lunges are made to start from the current position instead of home. Input: drag, click-then-click, and keys (1–0, Enter, Esc, ←/→ to change target, E for End Turn). Right-click, Esc or dragging back down all cancel._

### M0.6 Art pipeline (parallel, owner-paced) ✅
Owner installs the Codex CLI. Then confirm `codex exec` can generate an image from the prompt stem. Write briefs for the starter four (Maelia, Agathe, Anthe, Leonora) from DESIGN.md, generate 2–3 options each into `art/raw/<character>/`, and keep the prompt text beside each.
**Done when:** the owner has picked a direction for each starter, or has given notes for a second pass.

_18 Oct: pipeline confirmed. `codex exec` with its built-in image tool saved `art/raw/agathe/agathe-01.png` (1024×1536) from the stem plus brief. Run it with `< /dev/null`. Briefs for the other starters wait on the owner's notes on this test._

_18 Oct, owner's note: side-view battlers in HD pixel style, with a background-removal workflow. Built `npm run art` (gen/cut/sheet) with a battle sprite stem in DESIGN.md. Transparent requests return real alpha; chroma key works but leaks into see-through parts. `cut --px N` imposes a true pixel grid, because generated pixel art has none. Agathe options 02–05 are in `art/raw/agathe/` (04–05 use a Gloomdrawn sprite as style reference)._

_19 Oct: owner picked Agathe-02 (keep the rest for skins or alts) and asked for crisp sprites at every resolution. The blur at 1080 was the canvas being CSS-scaled at a fractional offset, plus GPU downscaling; both fixed. `pick` stores sprites at 1024px. Agathe-02 is in the slice, front row. Options for Maelia, Anthe, Leonora and the Bloom-Rib Hound are in `art/raw/`._

_19 Oct: **done.** Owner picked Maelia-02, Anthe-03, Leonora-02 and Bloom-Rib Hound-02 (all options kept). The slice party is now the starter four with their picked sprites. Portraits are still Gloomdrawn placeholders or letters._

## M1 tasks

The kits are in `docs/notes/starter-kits.md` (approved 19 Oct). Transcend waits for M2, so each starter brings four cards here and the deck is 16. The slice fight starts every gauge at 70.

### M1.1 Domain engines
Flesh (Embryo, the Poison status), Rapture (Tentacles, damage per hit lasting the combat, the end-of-turn volley, lowest-HP-first with overflow), Spirit (Essence, Retain, the Ritual cleanup discount to 0, held-turn counters) and Unbound (Mana debt). New operations: `gainMana`, `manaDebt`, `chargeUltimate`, `volley`, `changeCost`, `repeatNext`.
**Done when:** each operation and Domain hook has rule tests, including overflow across enemies, a Ritual reaching 0, and debt that never takes Mana below 0.

_Done 19 Oct. Domains are content modules (`src/content/domains/`) whose hooks resolve after every other trigger. Retain, held-turn counts and next-card effects are engine rules; a card's ultimate charge is a `charge` field, so a repeat doesn't charge twice. Choices to confirm with the owner: Poison is HP loss that ignores Shield; Mana debt beyond one full refill is dropped rather than carried; "when a turn starts with Mana debt" fires after the turn's draw, so an extra draw isn't swallowed by the draw-to-5._

### M1.2 The starter four
Stats, cards, passives and ultimates for Maelia, Agathe, Anthe and Leonora as data. The ultimate command and gauges; Strike and Defense charge 10.
**Done when:** every card, passive and ultimate has a kit scenario, a golden replay of a scripted fight is stable, and the content contains no engine code.

_Done 19 Oct. Kits are data in `src/content/characters/`, with authored text whose `{path}` slots show live numbers (validated at build). New engine pieces: the `fireUltimate` command and its preview, `heal`, `when`/`gte`, Poison on all enemies, and once-per-turn and `direct` trigger limits. `src/content/scenarios/kits.test.ts` has a scenario per card, passive and ultimate; `golden.test.ts` replays a fixed-policy fight against `golden/slice.txt` (update deliberately with `npx vitest -u`). The slice starts gauges at 70; firing them in the UI is M1.4._

### M1.3 The Bloom-Rib Hound
The enemy phase with intents from a seeded cycle, each previewed with its exact number. Win and loss end the combat.
**Done when:** intent tests pass, and the shown intent number always equals the damage dealt.

_Done 19 Oct. Enemies list intents that cycle in order; the enemy phase acts them in slot order and reveals the next. `previewIntent` gives the shown numbers from the resolving code. The slice and the golden replay are now the Hound fight. To confirm with the owner: an enemy's Shield clears when its own turn starts, mirroring the party's._

### M1.4 Combat UI
- Domain counters: Embryo, Tentacles × damage per hit, Essence.
- Mana debt in the orb.
- Ritual costs showing printed and current.
- Ultimate gauges on the party bar with a confirm to fire.
- The Hound's intent, Poison on the enemy.
- A win/lose screen with Restart.
- Default animations for volleys, ultimates and Poison ticks.
- The Hound's sprite on the right.

**Done when:** the e2e boots into the M1 fight and plays one full turn. The owner plays the fight and signs off feel (gate). ✅ Signed off 19 Oct.

_Signed off 19 Oct, after playtest fixes: turn counts run on the turns where they matter, combat start's events play, and the enemy sprites are in. Built 19 Oct: Portrait rings are the ultimate gauges (click, or Shift+1–4, when Ready, then confirm). Domain counters sit under the portraits; hover a portrait for its passive and ultimate. The Hound shows its intent with exact numbers, and the party bar shows incoming damage, Safe or Lethal. End of turn plays out in order (Tentacles, Poison, then each enemy action), and the hand waits until it finishes. Dev builds take `?enemies=` for other fights._

_19 Oct, owner's playtest: mechanics all work. Changes made: Shield blocks Poison; HP and Shield bars step as each hit lands (`vitals` from the engine); one badge per Domain (Tentacles shows the total with count × damage per hit); keyword tags on their own gold line and live damage and Shield numbers and status names coloured in card text, for the owner to judge. Then, at the owner's request, an icon set (`src/app/icons.tsx`: tentacle, embryo, essence, shield, poison, attack) replaces badge words, with hover and focus tooltips holding the name and rule; intents show an icon per action._

## M2 tasks

Content and rules are in `docs/notes/m2-content.md` (approved 19 Oct). Portraits and enemy sprites run through `npm run art` in parallel, owner-paced.

### M2.1 Launch statuses ✅
Bleed, Vulnerable, Weak, Stun, Delay and Falter. Statuses on the party side apply to the whole party. Statuses tick at the end of their side's turn. Control resistance turns Stun and Delay into Falter. Party statuses show on the party bar, with icons and tooltips.
**Done when:** each status has rule tests (stacking, timing, decay, interaction with Shield), and previews show Weak, Vulnerable and Falter in the numbers.

_Done 19 Oct. Statuses are content (`src/content/statuses/`) on generic fields; the party has one shared status list. `src/content/scenarios/statuses.test.ts` covers each. After the M2 playtest, a turn count drops at the end of each turn where it matters (Weak: the bearer's own; Vulnerable: the other side's), never in the turn it landed in. See DECISIONS.md._

### M2.2 Transcend ✅
The fifth card for each starter (deck 20). The `transcend` operation: once per combat, a Graveyard, +35 charge, and a Transcended ultimate for the rest of the combat. Generated cards (Maelia's Seed Pod). The "exactly five personal cards" check turns on. The portrait shows the Transcended state.
**Done when:** each Transcend card and Transcended ultimate has a kit scenario, and a Transcend card can't resolve twice in one combat.

_Done 19 Oct. `transcend` and `createCard` operations, an `exhaust` keyword (to the Graveyard), `ultimate.transcended` in each kit, and the five-slot check is on. Virelle's and Kibane's M0 placeholders were removed (their kits come in M5). The golden replay now plays a 20-card deck._

### M2.3 Enemy roster ✅
The approved enemies and encounters. Intents that apply statuses, Shield or heal allies, or summon; summons join next round in a free side slot. Multi-enemy layout and aiming.
**Done when:** each enemy's intent cycle and role has a scenario, summons respect the slot limit, and intent previews equal results.

_Done 19 Oct. Enemies hold a fixed `slot`; a fight lays out its starting enemies plus what they can summon (at most 4), and summons take a free slot and act from the next round. `summon`, Shield for allies, heal the weakest ally, encounters as content with HP overrides, enemy sizes. `enemies.test.ts` covers each role, and checks shown against dealt damage in every encounter. Enemies stand in as dummies until the owner picks sprites (options in `art/raw/`; whelp 03–04 replace 01–02, which missed the brief)._

### M2.4 Relics ✅
The approved relics, as triggers and modifiers, with Common, Uncommon, Rare and Cursed tiers. A relic bar along the top with tooltips.
**Done when:** each relic has a rule test, and relic trigger order follows acquisition order.

_Done 19 Oct. Seven relics as content (`src/content/relics/m2.ts`) with name, tier and text. New engine pieces: a `handDrawn` moment after the turn's draw, trigger filters by card slot, charge for the triggering card's owner, party damage for relics. A relic bar with tier colours and tooltips; dev builds take `?relics=`._

### M2.5 The gauntlet (owner gate) ✅
A three-fight run: normal, normal, elite. Party HP, gauges and relics carry over; gauges start at 0. Pick one relic from three after each win; "Run again" after a loss or the final win.
**Done when:** a golden replay of a scripted gauntlet is stable, the e2e plays into fight 2, and the owner plays it and signs off.

_Signed off 19 Oct, after playtest fixes: turn counts run on the turns where they matter, combat start's events play, and the enemy sprites are in. Built 19 Oct: `src/game/run.ts` holds the run (seeded encounters and fight seeds; HP, gauges and relics carry; relic offers; win and loss); the app's Gauntlet screen runs it, with a relic pick after each win and "Run again" at the end. Dev URLs: `?fights=` sets the encounters, `?enemies=`/`?relics=` give a single test fight. The scripted golden run wins all three fights with HP to spare, so expect to tune numbers._

## M3 tasks

Content and rules are in `docs/notes/m3-labyrinth.md` (answered 19 Oct).

### M3.1 The hex board ✅
Axial hex coordinates, tiles and their lifecycle (cleared tiles become path, Collapsing tiles vanish when stepped off, one-use Camps and Symptoms), adjacency, shortest routes over open tiles, and fog (layout, contents, landmarks). Pure, in `src/game/`.
**Done when:** board rules have tests: routes, stopping at content, Collapsing on step-off, fog reveal distances.

_Done 19 Oct. `src/game/hex.ts` (axial coordinates) and `src/game/board.ts` (tiles, routes, walking, fog, tile lifecycle), with the owner's fog distances (layout and contents at 2, landmarks at 4) as constants. Walking stops on every fight and choice tile. `board.test.ts` also builds the owner's temptation loop by hand and checks it behaves as drawn: a free first visit through both Collapsing tiles, the Symptom on any return, and taking the Symptom first keeps both Collapsing tiles._

### M3.2 Motifs and the validator ✅
Motifs as content (slots with roles and sockets), stitched into one board from the run seed, roles filled from pools. The never-stranded validator replays every Collapsing order. The temptation loop motif, as the owner drew it.
**Done when:** the validator rejects a hand-made stranding board, and passes boards from many seeds; the temptation loop behaves as drawn (free first visit, Symptom on return).

_Done 19 Oct. Motifs are drawn as text rows of hexes (`src/content/motifs/m3.ts`, legend in `src/game/motif.ts`); `src/game/labyrinth.ts` stitches them (route motifs heading east within a sixth of a turn, side motifs on sockets, touching only at joints, a joint touching only plain path), fills fights from pools and rerolls any board `findStranding` rejects. The M3 set gives 60 tiles, a 17–18 step route, 5–7 fights, 2 elites, 3–4 Events, 1–2 Shops, 2 Camps and 1 Symptom on every one of 200 seeds (`src/app/labyrinth.test.ts`), and the loop's Shop is never reachable without the toll. Found on the way: two Collapsing tiles side by side are a trap (on one, across, back off), which is why the loop pairs its Collapsing tile with the Symptom. The Boss tile draws from the elite pool until M4._

### M3.3 The map screen ✅
The board in React/SVG: fog, landmarks, the party token, click-to-move, tile tooltips. Entering a fight plays it and returns to the map.
**Done when:** e2e walks into a fight and back; the owner can read the board at a glance.

_Built 19 Oct, for the owner to look at. `src/game/expedition.ts` is the run: walking (the board after each step), fights from tiles, HP, gauges and relics carried, an elite's relic pick from three, a win at the Boss, and Symptoms that must be taken or turned back from. `src/app/LabyrinthMap.tsx` draws the revealed board as SVG hexes with labels, previews the route on hover with step numbers, and walks the party token tile by tile. Shops, Camps, Events and Symptoms show placeholder panels until M3.5–M3.6. The Labyrinth is now the default screen; `?fights=`, `?enemies=` and `?relics=` still open the gauntlet or a test fight, and `?seed=` and `?encounters=` set the board and its fights in dev builds._

_Owner feedback 19 Oct, applied: layout fog at 3 (contents stay at 2) so a tile's edge shows whether it leads on; routes cross only tiles whose contents are known, so the outer ring can't leak a fight; the view is centred on the party and follows it, instead of fitting the whole board. The Victory panel and the Obol counter move to M3.5._

### M3.4 The Bloom clock ✅
Ticks on fights, Events and Camp use; stages on the map; enemy scaling by stage at fight start; the Boss direction marker from Flowering; pods from Fruiting (removed after play, below).
**Done when:** tick and stage rules have tests, and scaled enemies preview and resolve the same numbers.

_Done 19 Oct. `src/game/bloom.ts` holds the stages (ticks 3/6/9/12, enemies +10/20/35/50%, placeholders), the Flowering elite draw for unseen fights, pods from Fruiting (2 per tick within 3 of the party), and the Boss direction. Won fights and Events tick the clock. The engine takes an `enemyScale` per fight: enemies' max HP (summons too) and outgoing damage, in the shared pipeline, so intents preview what resolves (`src/engine/scale.test.ts`). The map shows the stage, ticks to the next, a tinted ground per stage, pod tiles and a Boss marker at the view's edge. `?clock=N` starts the clock at N in dev builds; e2e wins a fight from 11 and sees Fruiting's pods._

_Owner feedback 20 Oct, applied: pods made single-lane paths a slog and are removed; Fruiting's pressure becomes Bloom nodes in M3.6. Fixed a bug found in play: Whelps summoned into a fatal Choir Bell volley kept their sprites and shadows, because a volley reported only its final HP and a win partway through dropped its remaining hits and deaths. Status timing now goes by source (DECISIONS, 20 Oct)._

### M3.5 Obols and Shops ✅
Obols from first clears; Shop stock and prices fixed by the seed on first reveal and kept all run; buying relics and services. A Victory panel listing a won fight's rewards before the map returns, and an Obol counter on the map.
**Done when:** a Shop keeps its stock across visits, can't be farmed, and buying is tested.

_Done 20 Oct. Won fights give 20 Obols (elites 45) plus the Bloom stage's bonus, shown on a Victory panel that also holds an elite's relic pick; the map shows the Obols held. A Shop rolls its stock on first entry from its own stream (one relic per tier from those not owned or on sale elsewhere, at 50/80/120/30) and keeps it, with what is sold, all run; Mend heals 25% of max HP for 40, once per Shop. Rules and tests in `src/game/expedition.ts` and `src/app/expedition.test.ts`. `?obols=N` starts a dev run with Obols._

### M3.6 Camps, Events and Symptoms ✅
The run's own deck; ownerless Symptom cards; Camp choices; Events as content with choices; Fruiting's Bloom nodes (a fight, a ±10% current HP gamble, or a Symptom card; DECISIONS 20 Oct).
**Done when:** each Camp choice, Event, Symptom and Bloom node choice has a scenario test.

_Done 21 Oct. Engine: cards without an owner are the party's own, dealt in from `CombatSetup.deck` and played by the front member; `percentOf` reads a share of party HP; `drawFewer`. The four Symptoms are content with scenarios (`src/content/scenarios/symptoms.test.ts`), and the four Events are content (`src/content/events/`). The run keeps its deck; Camps Rest for 30% of max HP and tick; Events are a forced choice that ticks; Bloom nodes are sown from Fruiting on. Tests for each in `src/app/expedition.test.ts`. Choices made without the owner are listed in `docs/notes/m3-labyrinth.md` ("As built in M3.6")._

### M3.7 A Labyrinth run (owner playtest) ✅
A whole board from the entrance to the Boss tile, with Run again.
**Done when:** a golden replay of a scripted run is stable, and the owner plays it and signs off.

_Golden replay done 22 Oct (`src/app/expedition.test.ts`, `src/app/golden/labyrinth.txt`): a scripted party explores the whole of board 7, stopping on every fight and choice it finds (resting when hurt, buying what it can, taking the first open Event choice, cycling a Bloom node's choices), and makes the Boss its last stop. It wins on seed 7 and plays every one of 30 boards to an end without getting stuck (19 won). Signed off by the owner 23 Oct._

## M4 tasks

Rules and content are in `docs/notes/m4-run.md` (answered by the owner 24 Oct).

### M4.1 Card rewards
The twelve reward cards as content. After a normal fight the Victory panel offers 3 cards from the party's pool (members' own cards, generic cards of the party's Domains, Unbound's always), each generic card with a random eligible owner; take one or skip. A taken card joins the run's deck, played by its owner.
**Done when:**
- scenario tests prove each reward card;
- tests prove the pool never shows a Domain the party lacks, never repeats a card in one offer, and only gives generic cards to eligible owners;
- elites and the Boss offer no cards;
- a taken card is in the next fight's draw pile, played by its owner, and the offer replays exactly from the seed.

_Done 24 Oct. Reward cards are content: each character's two beside her kit (`reward: true`), and each Domain's generic card in its Domain file (`domain`). Unbound's Domain is marked `anyTeam`, so its card is always offered and goes to anyone. The run's deck holds cards with owners (`RunCard`); a card without one is a Symptom, played by the front member. Long Vigil needed `damage` to hit every enemy, which lands hit by hit with vitals like a volley. The Victory panel shows the cards as card faces with the owner's stats as numbers (what depends on the fight shows as written), and the map's plaque became "Run deck", listing cards with their owners and Symptoms in gold. Card offers draw from their own stream, so boards, relic offers and Shop stock come out as before. Tests: `src/content/scenarios/rewards.test.ts`, "card rewards" in `src/app/expedition.test.ts`; the golden replay now takes the first card each time._

### M4.2 The Boss
HP bars per phase, the phase break (immunity until a Rouse that clears statuses), a phase cycle chosen by the Bloom stage, and no Bloom scaling for bosses. The Hollow Abbess with Rooted and, at Fruiting, Full Bloom as her second phase. The stage gives her a large anchor with Acolytes in side lanes, and blips under her bar. Her sprite through `npm run art`, picked by the owner.
**Done when:**
- engine tests prove a bar break loses the rest of the hit, refills the next bar, blocks damage until the Rouse, and the Rouse clears statuses and switches the cycle;
- scenario tests prove both of her second phases and that the Bloom doesn't scale her;
- the Boss tile holds her, and the owner has seen her fight.

### M4.3 Profile and banking
A profile save with banked pulls and a run count. A win banks 5 pulls (10 at Fruiting); a defeat or abandon banks 1 per elite beaten (3 at most). A result screen lists what was banked and why.
**Done when:** tests prove each banking case, including that a run quit before any progress banks nothing, and the profile survives a reload.

### M4.4 Save and resume
The run saved at map steps, node results and after each combat command, with the previous good save kept. A title screen with Continue, New run (which asks, then abandons a saved run) and the banked pulls. Abandon in a map menu. A save that can't be migrated ends as an abandon and banks its share. Export and import of one save file.
**Done when:**
- tests prove a run saved and loaded at any point plays on identically, a failed write keeps the last good save, and an unreadable run banks its share;
- an e2e test closes the page mid-fight and mid-walk and resumes on the same state;
- an export imported into an empty browser gives back the same profile and run.

### M4.5 A full run (owner gate)
**Done when:** the owner wins, quits and resumes a full run, and a golden replay of a scripted run through a save and a resume is stable.

## Notes
- Numbers in fixture content are placeholders; tuning happens in M1–M2 with the owner.
- Open design items are listed in HANDOVER.md. Settle each with the owner before the milestone that needs it.
