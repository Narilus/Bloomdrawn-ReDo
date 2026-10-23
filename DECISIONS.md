# DECISIONS

An append-only log. One line per decision: date, what was decided, and why if it isn't obvious. DESIGN.md and ARCHITECTURE.md hold the current rules; this file records how they got there. Superseded entries are struck through, never deleted.

## 2026-10-18 · Planning session (owner + Claude)

### Process
- Fresh start. Gloomdrawn, Bloomdrawn TS and Bloomdrawn-Unity are lessons, not a codebase. The old DESIGN.md files are not trusted for numbers.
- One continuous builder (Claude). Cheap-model delegation comes later, and only for pattern-copying chores; it is mechanically blocked from editing tests. No auditor agents.
- Planning files: PLAN.md, DECISIONS.md, a one-page CLAUDE.md, plus a one-page note only for real unknowns. No per-task contracts, worklogs, acceptance locks or role pipelines.
- The owner signs off feel and anything subjective. No agent-run feel acceptance.
- Machine: CachyOS for development; Windows 11 later for wrapper testing.

### Stack
- TypeScript strict. The pure rules engine has no framework, no browser APIs, no Math.random and no Date.
- Content is typed TS data validated with Zod, JSON-shaped so a future authoring tool can read and write it.
- React for UI and input; Motion for all animation, including Pixi actor properties.
- PixiJS v8 for the battlefield, mounted directly (no wrapper). Chosen over Phaser for best result with React and Motion; the M0 spike checks feel, not the choice.
- Vite as a single package with an import-boundary lint rule. Vitest for rules; Playwright for smoke tests and screenshots.
- Saves are versioned JSON in IndexedDB via idb-keyval, with a persistent-storage request, the previous good save kept, and export/import. No encryption: cheating is the player's business.
- Desktop wrapper (Tauri or Electron) decided later.

### Engine
- Commands are validated, then run as operations through a FIFO queue. Operations use one modifier pipeline and raise events, and events dispatch triggers.
- Trigger order is fixed: source, party slot, relic acquisition order, enemy slot.
- Victory and defeat are checked after every event.
- Chain depth cap is 8. A capped chain drops its remaining operations and logs it quietly. A trigger cannot re-fire from its own chain.
- Amounts are typed formulas. Domains are plug-in modules.
- Custom operations are allowed as a bounded escape hatch. One is promoted to the shared library once two kits need it.
- Card text: simple cards use generated text. Complex cards, ultimates and passives use authored templates with bound number slots, and a test fails raw numbers in authored text.
- Presentation uses an event-to-animation registry with defaults, so content is playable before art exists.

### Combat
- 6 base Mana, raised by relics and builds.
- Draw to 5 at turn start, maximum hand 10.
- Cost bands: Strike 1, Defense 1, Transcend 3–5, Flavour A and B 2–5.
- No extra turns or bonus action phases.
- Shared party HP is the sum of Max HP. HP carries between fights; Shield doesn't.
- Ultimate gauges persist across the run; banking them for elites is intended.
- Transcend is once per combat, and its ultimate upgrade lasts that combat only.
- Skill levels raise numbers only. Each card, the ultimate and the passive level individually.
- Rituals show a Ritual tag and a cost field marking the reduction. ~~Candle marker~~ dropped.

### Domains and identity
- Domains:
  - Flesh (Caro): Embryo, DoT.
  - Rapture (Aequor): Tentacles and volleys. Renamed from Abyss; Lovecraftian cult, never aquatic.
  - Spirit (original): Essence and held Rituals.
  - Unbound (Chaos): no resource, utility. Renamed from Void; never cosmic.
- The Bloom is a flesh-flower from space that remakes living things (Annihilation's Shimmer as the reference).
- Each character has a Bloom relationship: Embraced, Grafted, Resisting or Untouched. Theming is looser for Spirit and Unbound, so they don't all look the same. There is an anti-sameness rule within each Domain.
- Launch roster (8):
  - Starters: Maelia (Flesh), Agathe (Rapture), Anthe (w, Spirit), Leonora (Unbound).
  - Banner: Virelle, Isadora, Kibane, Hester (w).
  - Thalassa and Nerissa are retired. Shiori is a post-launch candidate.
- Art direction is "pastel subjects on dusk grounds"; this supersedes all-pastel. Palette, prompt stem, banned words and never-list are in DESIGN.md.
- Domain names never appear in image prompts.
- The OpenAI concepts are mood and rendering references only.

### Run
- Free-roaming hex Labyrinth with tiles: Path, Normal, Elite, Boss, Event, Shop, Camp, Symptom, Collapsing.
- Fog of war: layout within 2 tiles, contents when adjacent, landmarks visible from further away.
- The Bloom clock ticks on fights, Events and Camp use (lean). Walking, Shops and Symptoms don't tick it.
- Camps are one-use, and the player may step off without using one.
- Symptoms show their exact card, fire once, and don't tick the clock.
- Collapsing tiles are never needed for the main route; a validator checks this.
- The canonical temptation loop follows the owner's diagram.

### Meta and gacha
- The Morimens-style RPG layer is kept: levels, EXP bank, ascension, skill levels, dupes, weapons, depth tiers with power bands. No stamina, ever.
- Gacha:
  - SSR 3% / SR 15% / R 82%.
  - Hard pity at 30, reset on every SSR. **No soft pity.**
  - Featured 50/50, guaranteed after two losses; worst case 30/60/90. The loss count resets on obtaining the featured character.
  - Ten-pull guarantees SR+. Featured and Standard pity are tracked separately and carry over.

### Combat screen
- Party on a diagonal from bottom-left (front) to top-right (back), drawn front-last.
- Portraits and Domain counters top left; relics top centre; enemies right; hand bottom centre; Mana and piles bottom left; End Turn bottom right.
- The Bloom clock is shown on the map screen only.
- Idle breathing; lunge from a fixed home point, where a new lunge cancels the one in flight; recoil on hit. Skipping never reorders results.

### Art tooling
- Claude has no native image generation. Use `codex exec` (Codex CLI, owner's ChatGPT login) for concept work, and an OpenAI API key plus a script for bulk later. Claude writes prompts from the style guide and reviews the outputs; the owner picks.

## 2026-10-18 · M0 feel spike

- Owner signed off the M0.5 feel spike: "All expected animations play, keybinds work and the card feel is extremely smooth." PixiJS + React + Motion confirmed as the presentation stack.
- Hand interaction as built is the baseline: drag past the play line arms; single-target cards aim with an arrow; release over an enemy casts; drag back, Esc or right-click cancels; click-select then click an enemy; 1–0 select, Enter confirm, ←/→ change target, E ends the turn.
- Battle sprites are side-view battlers in an HD pixel style, cut out from their background (owner, 18 Oct). DESIGN.md gains a battle sprite stem for them.
- Agathe's battle sprite is Agathe-02. The other options are kept as possible skins or alternate characters (owner, 19 Oct).
- Sprites must stay crisp at every window size; store them large and downscale in game rather than at a small fixed pixel height (owner, 19 Oct).
- Starter battle sprites: Maelia-02 (softer face, better hair), Anthe-03, Leonora-02 (Leonora-03 a very close second). Bloom-Rib Hound: 02. Keep every other option (owner, 19 Oct).
- Starter kits approved as drafted in `docs/notes/starter-kits.md`, names included (owner, 19 Oct).
- Ultimate charge: Strike and Defense charge their owner's ultimate; other cards charge only if their text says so; Transcend cards give a chunk of around 30–40 (owner, 19 Oct).
- Rapture damage-per-hit increases (Censer Rite) last the whole combat, so Tentacle damage ramps over a fight (owner, 19 Oct).
- A card repeated by Bud Cutting charges its owner's ultimate once. Ritual costs bottom out at 0 (owner, 19 Oct).
- M1 task breakdown agreed (owner, 19 Oct).
- The M1 slice fight starts every ultimate gauge at 70, as if mid-run, so each ultimate can fire in one fight. Charge numbers stay as approved (owner, 19 Oct).
- M1 playtest (owner, 19 Oct): "more or less a complete success". Shield blocks Poison. HP bars move as each hit lands, not at End Turn. Each Domain gets one HUD badge (Tentacles reads as the total, with count × damage per hit). Keep the one-by-one damage ticks.
- M1 signed off: the starter four against the Bloom-Rib Hound, with the playtest fixes and the HUD icon set (owner, 19 Oct). Portrait art is for later.
- M2 content approved as drafted in `docs/notes/m2-content.md`: Transcend cards, enemies and encounters, relics, and the three-fight gauntlet as the M2 test (owner, 19 Oct).
- Status timing: enemies' statuses tick at the end of the party's turn (after Tentacles); the party's tick after the enemy phase; turn counts drop at the same moments (owner, 19 Oct).
- Bleed bypasses Shield, to set it apart from Poison (owner, 19 Oct).
- Debuffs on the party side apply to the whole party (owner, 19 Oct).
- Enemy buffers use Shield and heal for now; damage-multiplying enemy buffs are wanted later (owner, 19 Oct).
- Enemy sprites are generated during M2 (owner, 19 Oct).
- Ideas the owner raised for later, not yet decided: a skin selection; Transcend optionally changing a character's sprite (Maelia-03, with the exposed legs and pregnant body, fits that); enemies drawing alternate skins from their numbered sprites (owner, 19 Oct).
- A later balance pass may add more sources of ultimate charge, so "battery" characters become a team-building role (owner idea, 19 Oct).
- M2 playtest: turn-limited statuses (Vulnerable, Weak) count down only on their bearer's own turn, at its end. This corrects the earlier timing line, which had them drop at the end of the other side's turn. Poison and Bleed damage keep their timing (owner, 19 Oct).
- Superseding the line above (owner, 19 Oct: "if an enemy is going to make the party vulnerable, it should not expire until the end of the next enemy turn... it technically goes both ways"): a turn-count status counts the turns where it matters (Weak: its bearer's own turns; Vulnerable: the other side's turns, when it is hit) and loses one at the end of each, except the turn it landed in. So Vulnerable 1 from an enemy lasts through the next enemy turn; Vulnerable 1 from the party lasts the rest of that turn and the next party turn; Weak 1 either way covers the bearer's next turn.
- The enemies' turn is one moment (owner: "all those enemy actions during the applying turn happened simultaneously"): a status an enemy applies takes hold after that enemy turn, so it never changes another enemy's action in the same turn (owner, 19 Oct).
- M2 signed off: the gauntlet with statuses, Transcend, the enemy roster and sprites, relics and run-persistent ultimates (owner, 19 Oct).
- M3 draft answered (`docs/notes/m3-labyrinth.md`, owner, 19 Oct): the board size is the baseline to test. Walking stops on every fight and choice tile (fights, Events, Shops, unused Camps, unpaid Symptoms), and the route is shown and walked step by step. Fog reveals layout and contents within 2 and keeps everything discovered; a Boss direction helper comes with a clock stage (Flowering). The clock as drafted, with no HP loss at Fruiting. Shops always offer one relic of each tier. Camps offer Rest only, and Symptoms stay for the run. HP costs on Symptoms and in Events are a share of current HP, with live numbers in the text.
- Open: Fruiting's pressure ("the Bloom closing in"): pods on path tiles, remaining fights turning elite, or both.
- M3.3 map feedback (owner, 19 Oct): fog reveals layout within 3 and contents within 2, so you can see whether a tile leads on or is a dead end. The map view stays centred on the party's tile, so the board's shape doesn't give away the Boss. A Victory panel listing rewards after a won fight, and an Obol counter, come with Obols (M3.5).
- Fruiting's pressure is pods (owner, 19 Oct): from Fruiting on, marked pods appear on path tiles near the party as the clock ticks, and stepping on one starts a fight. This settles the open line above.
- When statuses take hold (owner, 20 Oct): a status an enemy applies during the enemy turn, buff or debuff, takes hold and starts counting only once that turn is over, so shown damage never changes against you mid-turn. Everything else takes hold at once: statuses the party applies (they are part of your combo, even a relic reacting during the enemy turn) and an enemy's stated reaction during your turn (such as "when struck, apply Weak"). Vulnerable stays available to both sides.
- Status tooltips state only the effect ("Takes 50% more damage."), not the turn-count mechanics (owner, 20 Oct).
- M2 enemy sprites: Root-Mat-01, Censer Acolyte-02, Pod-Thrower-01, Seedling-02, Lantern Surveyor-01, Thorn-Wall Matron-01, Hound Mother-01, Bloom-Rib Whelp-02. Pod-Thrower-02 and Seedling-01 are as good and would make visual variants (owner, 19 Oct).
- Fruiting's pressure is Bloom nodes, not pods (owner, 20 Oct, after playing M3.4): pods every tick turned single-lane paths into a slog. From Fruiting on, Bloom nodes appear on path tiles near the party, ideally ahead, roughly one per 6–10 tiles walked. Landing on one forces a choice, and the node is used up: a fight from the normal pool, a 50/50 gamble to lose or heal 10% of current HP, or taking a Symptom card. Choosing doesn't tick the clock. Built in M3.6 with Symptoms; until then Fruiting is +50% enemy strength only. This replaces the pods line above.
- Run rewards, for when meta rewards arrive (owner, 20 Oct, provisional): a won run gives 5 pulls among its rewards, and winning at Fruiting doubles the run's rewards (10 pulls). The bonus goes by the stage at the Boss win.

- M3.5 signed off: Obols, the Victory panel and Shops as built, including Fruiting's +50% Obols, Shop stock rolled on first entry, the Obol counter under the party HP and no Mend at full HP (owner, 21 Oct).
- M3.6 signed off: Camps, Events, Symptoms and Bloom nodes as built, with the choices made without him accepted: an Event is a forced choice once entered, every Event choice ticks the clock (the Gardener's shears once more), Rest can't be used at full HP and heals only up to full, an Event's random relic may also be on sale in a Shop, the Event scene text stands as drafted for now, and rarer Events wait until they are written. The Symptoms plaque lists each card once with its count (owner, 22 Oct).
- M3 signed off: the whole Labyrinth run as built, from the entrance to the Boss tile with Run again (owner, 23 Oct).

## Open
- Gear at launch or later (recommendation: later).
- Bloom clock ticks and effects per stage; whether Camp use ticks it (lean: yes).
- Power-band table; reward economy.
- Final names: Anthe, Hester, Obols, pull and currency names. Shiori's place.
- Content warnings and intensity settings; the desktop wrapper.
