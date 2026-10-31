# Bloomdrawn — Technical Architecture v0.1

18 Oct 2026 · William Blight · Exported from https://claude.ai/code/artifact/d32a9cce-ae63-4c84-b97c-551fb3c1e0ed

## Goal

Adding a card, status, relic, enemy or character should be a typed data file that composes existing building blocks, with no engine or UI changes. Code changes only when a genuinely new kind of behaviour appears, and then it is one small, tested building block that all later content can reuse.

This note is the companion to the Bloomdrawn Design Document v0.1. The design doc says what the game is; this says how it is built. Where they disagree, the design doc wins.

**Design rules:**

- **The engine knows nothing about specific content.** It runs operations, raises events and applies modifiers. It never checks for a character's name.
- **Content knows nothing about the screen.** A card says what happens, not how it looks.
- **One rules path.** Previews, enemy intents and card text come from the same code that resolves the play.
- **The compiler is the first reviewer.** A misspelled ID, a missing field or a wrong argument fails the build, not a playtest.

## How it fits together

A command is validated, then its operations run one at a time through a resolution queue. Each operation reads the content registry and asks the modifier pipeline for its numbers. Every event it raises can wake triggers, which add more operations to the queue. Only the finished event list reaches the screen.

```
Player input (drag, click or keys — React)
  → Command (play card, ultimate, end turn)
  → Validate (costs, targets, phase) ──invalid──→ Rejected: nothing changes
  → Resolution queue (operations waiting to run)  ←── triggered operations ──┐
  → Operation (damage, draw, gain Embryo)                                    │
       ← definitions ── Content registry                                     │
       ↔ amounts ────── Modifier pipeline (flat, multiply, Shield)           │
  → Events (ordered, with source and target) ── each event → Trigger dispatch┘
  → new state + events → Presentation (animates the event list)
```

The highlighted Operation box is the only place behaviour lives; everything around it routes, orders or displays.

## Project layout

One Vite package, split into folders whose import rules are enforced by a lint rule. Arrows only point inward: UI may import the engine, the engine never imports UI.

```
src/
  engine/        pure rules: state, commands, resolution queue, triggers, modifiers, RNG
    ops/         one file per effect operation, each with its own test
  game/          pure run, map, meta and gacha rules built on engine primitives
  content/       typed definitions: characters, cards, statuses, relics, enemies, motifs
    registry.ts  builds and validates the content registry at startup and in tests
  stage/         PixiJS battlefield: actors, VFX, animation registry
  app/           React: screens, hand, HUD, menus
  save/          versioned save format, migrations, storage adapters
tools/
  lab/           dev-only content lab (spawn any party, enemy, card)
```

| Folder | May import | Must not import |
| --- | --- | --- |
| engine | nothing outside engine | content files, game, stage, app, browser APIs, Math.random, Date |
| game | engine | stage, app, browser APIs |
| content | engine (helpers and types) | game, stage, app |
| stage, app | everything above | — |
| save | engine, game types | stage, app |

The engine receives the content registry as an argument. It never imports content files directly, which keeps tests free to use tiny fixture registries.

## Content model

Every piece of content is a definition: a plain, JSON-shaped object with a stable ID, built through small typed helper functions. The helpers exist for autocomplete and type checking; what they return is ordinary data.

- **Stable IDs.** IDs are namespaced strings (`virelle.rupture-bloom`, `status.bleed`), never reused once shipped. Saves store IDs, never objects.
- **Typed references.** A card that applies `status.bleed` references the Bleed definition through a typed ID, so a typo is a compile error.
- **Validation.** Every definition family has a Zod schema. The registry validates everything at startup and in a test, and reports the file and ID of anything broken.
- **Cross-checks.** The registry also checks relationships: every card has a valid owner (or none: the party's own cards, Symptoms, which the front member plays and which have no personal slot), a card reward sits outside its owner's five cards, a Domain's generic card names its Domain and no owner (it gets one when gained), every starter character has exactly five personal cards, every referenced status exists, and cost bands match the design doc.
- **Versioning.** Each definition carries a content version. Changing a shipped definition's meaning means a new version, and the save layer decides whether old runs migrate or end.

| Definition family | Built from |
| --- | --- |
| Card | Cost, target, tags, owner, a list of operations |
| Status | Stacking rule, decay, triggers, modifiers |
| Character | Stats table, five card IDs, passive (triggers and modifiers), ultimate (operations and Transcended operations) |
| Domain | Resources, automatic hooks, HUD counter |
| Enemy | Stats, intent pattern (lists of operations), traits |
| Relic, weapon, Symptom | Triggers and modifiers |
| Encounter, motif, reward table | Plain data referencing the above by ID |

## Effect operations

An operation is the smallest unit of behaviour, such as "deal damage" or "gain Embryo". Every card, ultimate, passive, relic and enemy intent is a list of operations, and the operation library is the only place game behaviour is written.

Each operation is one file that exports:

- **Arguments schema:** what the operation takes (an amount formula, a target, a status ID).
- **Validate:** whether it can resolve right now (for example, enough Embryo to consume). A failure rejects the whole command with nothing changed.
- **Resolve:** takes the state and context (source, owner, target), returns the new state and the events it raised.
- **Preview:** the same calculation, without consuming randomness or changing state.
- **Describe:** a generated fallback description ("Deal 6 + Attack damage"), used as-is for simple cards. See Card text below.

### Starting library

| Group | Operations |
| --- | --- |
| Damage and defence | damage, loseHp, gainShield, heal |
| Statuses | applyStatus, removeStatus, reduceStacks, detonate (trigger a status's stacks at once) |
| Resources | gainResource, consumeResource, gainMana, manaDebt |
| Cards | draw, discard, exhaust, createCard (a copy can carry its own cost and extra keywords, such as Fleeting: to the Graveyard when played or at end of turn), changeCost, repeatNext (the next card resolves twice), retain, duplicate |
| Ultimates | chargeUltimate, transcend (once per combat; swaps in `ultimate.transcended`) |
| Domain engines | volley (hits that take the lowest-HP enemy, overflow carrying on; a `volleys` modifier fires it again, each pass choosing targets afresh) |
| Enemies | delay, stun, changeIntent |
| Control flow | when (a condition such as `gte`), ifConsume (spend a resource for a bonus branch), repeat, forEachTarget, choose |

Control-flow operations hold lists of other operations, so complex cards are nested data, not code. `ifConsume` encodes the Flesh rule once: Embryo is consumed only when the bonus branch actually resolves.

Targets are data too: `self`, `party`, `chosenEnemy`, `allEnemies`, `lowestHpEnemy`, `randomEnemy` (from the seeded stream). Volley targeting with overflow is a selector, not a special case.

### Card text

Card text is authored where it matters and generated where it doesn't, but its numbers always come from the rules.

- **Simple cards** (Strikes, Defenses, basic generated cards) use the generated description.
- **Flavour cards, ultimates and passives** have authored text written as a template with number slots, for example `Deal {dmg} damage. If you consume {embryo} Embryo, detonate all Bleed.` Each slot points at a formula in the card's operations, so the shown numbers include the owner's stats, skill level and active modifiers, and update live in the hand.
- **Keywords** (Bleed, Retain, Ritual) are marked in the template and get tooltips from their definitions.
- **A content test** fails any authored text containing a raw number instead of a slot, or a slot that points at nothing. Wording is free; numbers can never drift.

## Events and triggers

Everything that reacts — passives, statuses, relics, weapons, Symptoms, Domain hooks — declares a trigger: an event to listen for, an optional filter, and a list of operations. The engine raises events; it never calls content directly, so a new status or relic never touches the turn loop.

### Events

Lifecycle: `combatStart`, `turnStart`, `handDrawn` (after the turn's draw, where "at turn start, draw" effects hang), `manaDebtPaid`, `cleanup`, `turnEnd`, `statusTick` (damage over time; one per bearer, `target` = that bearer: each enemy at the end of the party's turn, the party after the enemy phase), `enemyPhaseStart`, `enemyActed`, `combatEnd`. Actions: `cardPlayed` (with the card's definition ID, for keyword filters), `ultimateFired`, `transcended`, `volleyFired` (before a volley's hits, carrying the card if a card fired it), `controlled` (an enemy's action skipped by Stun or Delay, or weakened by Falter). Outcomes: `damageDealt`, `damageTaken`, `shieldGained`, `healed`, `statusApplied`, `statusRemoved`, `resourceGained`, `resourceConsumed`, `ultimateCharged`, `cardDrawn`, `cardExhausted`, `enemyDefeated`, `barBroken`. Bookkeeping: `deckShuffled`, and `chainCapped` (the quiet log line when a chain hits the depth cap).

A trigger may be limited to `once: 'turn'`, and its filter may require `direct` (raised by a card or ultimate itself, not by another trigger), which is how "the first time each turn a card gains Embryo" is written. Filters can also name the event's `source` relation (`self`, `other`, or `party`: any member), a `resource`, a `status`, a card `keyword` or personal `slots` for `cardPlayed`, and `fromCard` (raised while a card resolved: a card's volley, not the end-of-turn attack). A reaction can land on the event's target (`applyStatus` with `eventTarget`).

Every event carries its source, owner, target and amount, so filters can say things like "when a Rapture card owned by me is played" or "when Embryo is consumed by a spender".

### How a command resolves

1. The command is validated completely. If anything fails, nothing changes and no event is raised.
2. The card's operations go into a resolution queue.
3. Each operation resolves and raises its events.
4. For each event, matching triggers are collected in a fixed order and their operations join the queue.
5. After every event the engine checks victory and defeat; on either, resolution stops immediately.
6. The queue empties, and the command returns the new state plus the ordered event list.

### Ordering and loop guards

- **Fixed order:** triggers fire in a fixed order — the source that raised the event, then party slot order, then relic acquisition order, then enemy slot order. Replays and saves are exact.
- **No self re-fire:** a trigger cannot fire again from an event its own operations raised in the same chain.
- **Depth cap:** chains have a depth cap (starting at 8). If a chain reaches it, the remaining triggered operations are dropped and the combat log notes it quietly. Development builds flag it as a content bug, and randomised test combats check that no shipped content can reach it.
- **Per-turn limits:** triggers can declare limits such as "once per turn" or "three times per combat", tracked in state.

## Modifiers and formulas

Numbers are never calculated inside a card. Every damage, Shield, healing and cost value passes through one modifier pipeline, and every amount is a typed formula.

### The pipeline

| Step | Applies | Examples |
| --- | --- | --- |
| 1. Base | The operation's formula | 6 + owner's Attack |
| 2. Flat outgoing | Added amounts from the source side | +3 damage relic |
| 3. Outgoing multipliers | Source-side multipliers | Weak ×0.75 |
| 4. Incoming multipliers | Target-side multipliers | Vulnerable ×1.5 |
| 5. Shield | Absorbs damage unless the hit ignores Shield | — |
| 6. Floor | Round down at each multiplier step; never below 0 | — |

A modifier is data: which value it touches, which step, a formula, a filter ("Flesh cards only", "against Bleeding targets"), and a lifetime (this card, this turn, this combat, while a status lasts). Statuses, relics, weapons and passives all register modifiers the same way. Previews run this exact pipeline, so a preview and its result cannot disagree. Besides damage and Shield, a modifier can change the stacks a status is applied with (`stacks`, shown live in card text) or the stacks a status's own trigger takes off (`stackLoss`, Bleed's tick), each for one named status. A party modifier marked `on: 'enemies'` acts on every enemy's side instead of the party's.

### Formulas

Amounts are small typed expression trees, never strings and never `eval`:

```ts
add(6, stat('attack'))                          // 6 + owner's Attack
mul(resource('tentacles'), resource('potency')) // Tentacles × damage per hit
mul(add(12, stat('attack')), add(1, mul(0.5, resource('essence'))))
```

Formulas can read owner stats, party stats, Domain resources, status stacks (the source's, or the chosen target's with `targetStacks`), cards in hand (and those with a keyword, and their turns held), Mana spent this turn, cards of a kit slot played earlier this turn (`playedThisTurn('strike')`), turn number, a percentage of the party's current or max HP (`percentOf`, for costs that scale), and the amount just consumed. Anything outside that list is a compile error.

## Everything else is a composition

Once operations, triggers and modifiers exist, every other system is a way of bundling them. No family below needs engine code of its own.

- **Status:** a stacking rule (add, refresh or highest), triggers and modifiers, plus three generic fields: `skipsAction` (Stun advances the intent, Delay holds it), `resistedAs` (an enemy with the `resistsControl` trait gets Falter instead) `endsAfterAction` (Falter) and `endsWithTurn` (gone when the party's turn ends, after the end-of-turn volley: "this turn"). Bleed and Poison are `statusTick` triggers; Vulnerable and Weak are modifiers whose stacks are turns, declared by `lasts`: `ownTurns` (Weak: the bearer's own turns) or `opposingTurns` (Vulnerable: the turns it is hit on). At the end of each side's turn the engine's `countDown` takes one stack from every status that matters on that turn, except stacks that landed during it (`fresh` on the stack, cleared at every turn end). `previewIntent` runs the party's `countDown` first, so the shown hit stays exact. The enemies' turn resolves as one moment: stacks an enemy applies during it are `pending` (whatever the status, turn count or not) and modifiers ignore them until that turn ends, so neither a debuff on the party nor a buff on the enemies changes another enemy's action that turn. Everything else holds at once: the party's statuses, even from a relic reacting in the enemy turn, and an enemy's reaction during the party's turn. The party and its members share one set of statuses, so debuffs land on the whole party.
- **Domain:** resources (name and starting value; later, whether they persist past combat), automatic hooks, and a HUD counter (a count, optionally × damage each, e.g. Tentacles × damage per hit). A Domain's hooks are active while any party member belongs to it, and resolve after every other trigger on the same event, so Tentacles attack after scheduled effects. Rapture's end-of-turn volley is a hook on `turnEnd`; Spirit's Ritual discount is a hook on `cleanup`. Unbound declares nothing. A fifth Domain later would be one new module (`src/content/domains/`).
- **Character:** base stats, five card IDs, a passive (triggers and modifiers), and an ultimate (cost, operations, Transcended operations). Skill levels are a level index into number tables inside her definitions, so levelling never changes behaviour. Dupe levels C1 to C5 are a list of replacements (stats, passive, ultimate, or a card swapped for its variant, a card marked `variantOf`), applied in order up to the member's level (`src/engine/dupes.ts`). Her stats grow by her role (`role`) with her level (1 to 40) and ascensions (0 to 3): `base × (1 + (M − 1) × (0.7 × (level − 1) / 39 + 0.1 × ascensions))`, rounded, M being the role's level-40 multiplier and base her stats at her dupe level (`src/engine/levels.ts`; `docs/notes/m6-scaling.md`). A member's dupe level, level and ascensions are in combat state, absent at C0, level 1 and none, and the engine reads her character only through `characterOf`.
- **Enemy:** stats, traits, and an intent pattern: a list or small state machine of named intents, each a list of operations. Intent previews come from those operations' preview functions. A Boss lists later HP bars as `phases`, each with its HP, a Rouse and its own intents (`src/engine/phases.ts`): every operation that takes HP calls `fall` when an enemy reaches 0, which breaks to the next bar (the rest of the hit is lost, `barBroken`) or defeats it. A broken bar leaves the enemy `rousing`: the damage pipeline and `loseHp` give it 0 and volleys pass it by, until its next action, the Rouse, has acted.
- **Relic, weapon, Symptom, Curse:** triggers and modifiers with a rarity and a lifetime (run, or profile for weapons). A Symptom is simply a card whose operations include its own cost.
- **Encounter, motif, reward table, banner:** plain data that references the above by ID. A motif is drawn as text rows of hexes (legend in `src/game/motif.ts`) with a place: start, route, end or side. `src/game/labyrinth.ts` stitches a run's board from motif pools (`LabyrinthDef`), and `findStranding` replays every order of stepping off Collapsing tiles to prove the Boss stays reachable; `src/game/board.ts` holds the board's tiles, routes, walking and fog. `src/game/bloom.ts` is the Bloom clock: stages, the enemy scale a fight starts with (`CombatSetup.enemyScale`, applied by the engine to enemy HP and outgoing damage; never the Boss, whose encounter may name a `fruiting` encounter to fight instead from Fruiting on), and what a tick does to the board (the Flowering elite draw). `src/game/expedition.ts` is the Labyrinth run built on them (walking, fights from tiles, carried HP, gauges and relics, the clock, Obols and Shops, card rewards and the run's deck (`RunCard`: a card and the character who plays it, none for a Symptom), Camps, Events and Bloom nodes; Events are content applied by the run, never by the engine); the app's `Labyrinth` screen plays it.

## Custom operations

Some kits will be genuinely bespoke. Rather than contort the data format to express them, a character may register a named custom operation: a pure TypeScript function with the same shape as a library operation (arguments schema, validate, resolve, preview, describe).

- **Bounded:** a custom operation lives beside its character's content, is pure, uses only the seeded randomness it is handed, and has its own test.
- **Promotion rule:** once two kits want the same custom behaviour, it is promoted into the shared library and both kits use the generic version.
- **Visible:** the registry lists every custom operation, so their number is easy to watch. Many custom operations would signal a missing generic building block.

The previous project banned this outright, which turned simple bespoke kits into heavy engineering. A small, visible escape hatch is cheaper than a perfect abstraction.

## Determinism, randomness and saves

The same state, content version and commands always produce the same result. That one property gives exact saves, reproducible bug reports and golden-replay tests.

- **State is plain data.** Combat, run and profile state are JSON-serialisable objects with no class instances, functions or references to content objects (only IDs).
- **Transitions are pure.** `apply(state, command, registry)` returns a new state and events, or a rejection with the old state untouched. It also returns the HP and Shield after each event (`vitals`), so the HUD's bars move as each hit lands on the battlefield. An operation that lands several hits in one go (a volley) returns the vitals after each of its events, and victory and defeat are judged on them, so a fight won partway through a volley ends on the killing hit with every earlier death recorded.
- **Named random streams.** A small seeded generator, with separate streams stored in state: shuffle, targeting and enemy intents per combat; map layout, map content, rewards and shops per run; gacha per banner family. Adding a random call in one stream never shifts another.
- **No ambient inputs.** The engine never reads the clock, `Math.random` or the screen. Cosmetic randomness (idle offsets, particles) uses its own stream in the presentation layer.

### Saves

| Save | Contents | Written |
| --- | --- | --- |
| Profile | Roster, levels, items, dupes, weapons, banner pity, pull history, settings | After every profile change |
| Active run | Full run state including map, Shop stock, deck, ultimate gauges, RNG streams | At map steps and node results, and after each resolved combat command |

Each save carries a schema version and content version (`src/content/version.ts`). Migrations are plain functions from one version to the next. A failed write never replaces the last good save.

So far the profile holds banked pulls (Purified Blooms on screen; a new profile starts with 10), a run count, the characters gained with their dupe levels, levels and ascensions, items by ID (Pollen, Ducats as `money`, Memories, ascension materials; names in `src/content/items.ts`), the banner Focus, the gacha (its stream, pity and 50/50 losses per banner family, and every pull's audit record), the team presets, and the run in progress's ID and elite tally (`src/game/profile.ts`, saved as `src/save/profile.ts`). `src/game/gacha.ts` pulls on a banner (`src/content/banners.ts`): rates, hard pity, the ten-pull's SR, the Focus 50/50 and its two-loss guarantee, dupes and Pollen; the app seeds the stream on a profile's first pull. The starters (`src/content/roster.ts`) are owned by every profile and never listed in it; `partyProblem` says why a party can't start a run. `src/game/levels.ts` levels a character up with Memories and Ducats (smallest Memories first, the excess refunded as smaller ones) and ascends her at 10, 20 and 30 with her Domain's material (`DomainDef.material`) and Ducats; `buyPreset` buys a team preset with Ducats. A run keeps its party's dupe levels, levels and ascensions from when it began (`Expedition.dupes`, `Expedition.levels`, `Expedition.ascensions`, a `Growth`) and gives them to every fight. The run save (`src/save/run.ts`) holds the expedition and, during a fight, the whole combat state; its schema checks the outline, and `missingContent` (`src/game/check.ts`) checks that every ID it names still exists. `src/app/saves.ts` owns both in the browser:
- **Boot:** continue the run if its save reads and matches the profile's run in progress; drop a save the profile doesn't track (already banked); otherwise end the run as abandoned, banking from the profile's tally.
- **Writes:** one queue, in order. Run saves coalesce, so a burst of combat commands writes only the newest. When a run ends, `runBanking` gives what it banks (pulls; Memories and Ducats per fight, elite and Boss; the Boss's material), with a line per reason for the result screen, item names coming from content; the profile is banked and the run save removed.
- **Files:** one backup file holds every save; an import is validated whole before anything is written.

**Storage:** in the browser, saves are plain JSON in IndexedDB through `idb-keyval`, a tiny, well-tested wrapper. The game asks the browser to keep its storage persistent, and keeps the previous good save beside the current one. An export/import save-file button protects players against browser data clearing and lets them move saves between machines. Saves are not encrypted or signed; editing them is the player's business. Desktop builds later write the same JSON to files.

## Presentation layer

The screen replays the engine's event list; it never decides anything. Results are final the moment the engine returns, and animation only controls when the player sees them.

### Event-to-animation registry

Each event type maps to a default animation: `cardPlayed` lunges the owner, `damageTaken` plays a recoil and a number, `statusApplied` pops an icon. Content may name a specific animation or VFX by key ("Maelia's ultimate burst"). If none is named, or the asset is missing, the default plays. New content is therefore playable before any art exists.

### Actors

- Each party member and enemy is its own PixiJS actor with a fixed home point, a body, and anchors for intents, statuses and numbers.
- Idle breathing is a looping scale and bob, offset per actor.
- Every lunge starts from home. A new lunge cancels the one in flight and restarts from home, so rapid play never drifts.
- Enemy actions play one at a time in event order. Speed-up and skip compress timing but never merge or reorder actions.

### Hand and input

- React owns all input. The hand is a fan recomputed from the current hand order on every change, so repeated hovers and drags can never accumulate offsets.
- Drag, click and keyboard all build the same complete command. Nothing reaches the engine until the command is complete, so a cancelled drag spends nothing.
- The UI shows the engine's preview for the hovered card and target, never its own maths.

### Performance budget

A starting budget: 60 fps on a mid-range laptop with four party actors, five enemies and their effects. It is checked in the content lab, not by a harness.

## Worked examples

Three examples show the format end to end. Names and numbers are placeholders for tuning; the shape is the point.

### A card: Virelle's spender

```ts
export const ruptureBloom = card({
  id: 'virelle.rupture-bloom', owner: 'virelle', slot: 'flavourB',
  cost: 3, target: 'chosenEnemy', tags: ['spender'],
  effects: [
    damage(add(6, stat('attack'))),
    ifConsume('embryo', 2, [detonate('status.bleed')]),
  ],
});
// Generated text: "Deal 6 + Attack damage. Consume 2 Embryo: detonate Bleed."
```

### A status: Bleed

```ts
export const bleed = status({
  id: 'status.bleed', stacking: 'add', max: 99, tags: ['debuff', 'removable'],
  triggers: [
    { on: 'turnEnd', filter: ownSide(), do: [loseHp(stacks()), reduceStacks(1)] },
  ],
  detonate: [loseHp(stacks()), removeStatus()],
});
```

### A full kit: Agathe, the Choir-Mother

```ts
export const agathe = character({
  id: 'agathe', domain: 'rapture', rarity: 'SSR', bloom: 'embraced',
  stats: statTable('agathe'),            // HP / Attack / Defense by level
  cards: ['agathe.strike', 'agathe.defense', 'agathe.transcend',
          'agathe.call-the-choir', 'agathe.censer-rite'],
  passive: { triggers: [
    { on: 'combatStart', do: [gainResource('tentacles', 1)] },
  ]},
  ultimate: {
    cost: 100,
    effects: [gainResource('tentacles', 3)],
    transcended: [gainResource('tentacles', 3), tentacleVolley()],
  },
});

export const callTheChoir = card({
  id: 'agathe.call-the-choir', owner: 'agathe', slot: 'flavourA', cost: 2, target: 'self',
  effects: [
    gainResource('tentacles', 2),
    when(gte(resource('tentacles'), 4), [draw(1)]),
  ],
});

export const censerRite = card({
  id: 'agathe.censer-rite', owner: 'agathe', slot: 'flavourB', cost: 3, target: 'auto',
  effects: [gainResource('potency', 2), tentacleVolley()], // lasts the combat: Tentacle damage ramps
});
```

`tentacleVolley()` is `volley(resource('tentacles'), resource('potency'))` from the Rapture module. The Rapture Domain module supplies the rest: the Tentacle and damage-per-hit resources, the automatic end-of-turn volley, and the HUD counter. Agathe's definitions contain no engine code, and a second Rapture character would reuse every piece.

## Testing and the content lab

Tests prove rules at the cheapest level that can prove them; the owner judges feel. There are no acceptance harnesses, checksum locks or audit loops.

| Layer | Proves | Example |
| --- | --- | --- |
| Operation tests | Each operation resolves, previews and describes correctly | `ifConsume` spends nothing when the bonus branch fails |
| Kit scenarios | A character plays as designed in a scripted mini-combat | Agathe at 4 Tentacles draws a card after Call the Choir |
| Invariants | Rules that must always hold, checked across many random seeds | A card is in exactly one pile; resources never go negative; rejected commands change nothing |
| Golden replays | A fixed seed and command list produce the same events and state | Catches unintended changes to any rule |
| Content validation | Every definition and reference is valid | A card pointing at a missing status fails the build |
| Smoke and screenshots | The app boots, a fight can be played, the layout holds at 16:9, 16:10 and ultrawide | Playwright, kept small |

Kit scenarios use a short format, so writing one takes minutes:

```ts
scenario('Agathe draws at 4 Tentacles', {
  party: ['agathe', 'maelia', 'anthe', 'leonora'], enemies: ['training-dummy'],
  setup: { tentacles: 2, hand: ['agathe.call-the-choir'] },
  play: [{ card: 'agathe.call-the-choir' }],
  expect: { tentacles: 4, handSize: 1 },
});
```

### The content lab

A development-only screen to pick any party, any enemies and any starting hand, set resources and statuses, and play. It is where a new kit is first tried, where animation and feel are judged, and where scenarios are born: a lab session can be exported as a scenario test.

## Later: an authoring tool

A visual editor for cards, statuses and kits is out of current scope, but three choices made now keep it cheap to build later.

1. **Definitions are JSON-shaped.** The TypeScript helpers only build plain objects. An editor could read and write JSON validated by the same Zod schemas, and the TS files could either be generated from that JSON or keep coexisting with it. Moving storage formats would be mechanical, not a rewrite.
2. **Schemas describe themselves.** Each operation's argument schema is enough to generate an editing form: a dropdown of operations, typed fields for amounts and targets, and nested lists for control flow.
3. **The lab is the preview.** An editor would be the content lab with a form beside it: change a number, replay the scenario, see the result.

What the tool would offer when built:

- Card and kit editing with generated rules text shown live.
- Validation errors inline, with the same messages as the build.
- One-click scenario export from what you just tested.
- A view of every custom operation, to spot missing generic building blocks.

## Open technical questions

All settled; recorded here for reference.

- [x] Renderer: PixiJS v8 for the battlefield, React for UI, Motion for animation. Motion's `animate()` also drives Pixi actor properties, so cards and sprites share one timing system. Pixi is mounted directly in a React component rather than through a wrapper library. The M0 spike checks feel, not the choice.
- [x] Immutable updates: plain copies in the engine, measured before optimising.
- [x] Triggered operations resolve as a queue (first in, first out), with the fixed trigger order above.
- [x] Card text: authored templates with bound number slots for complex cards; generated text for simple ones.
- [x] Chain depth cap starts at 8; a capped chain drops its remaining operations with a quiet log line.
- [x] Storage: IndexedDB via `idb-keyval`, plain JSON, persistent-storage request, export/import backups.
