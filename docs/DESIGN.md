# Bloomdrawn — Design Document v0.1

18 Oct 2026 · William Blight · Canonical copy: https://claude.ai/code/artifact/7f39bdcb-d5e4-4ee2-af97-b5e114beb49c (this file is an export; the repo copy becomes canonical once the repo exists)

## Overview

Bloomdrawn is a party-driven roguelike deckbuilder with a full RPG gacha layer and no monetisation. You collect characters, field a team of four, and their cards become one shared deck for expeditions into the Bloom's territory.

A flower of flesh came from space and opened on the planet. It grows into living things and remakes them: ornate petals on meat, vine and tendril. Each run is an expedition into the region it has taken. The longer you stay, the further it blooms.

Primary reference: **Morimens** (party deckbuilding, Domains, stats and builds). Secondary: **Slay the Spire** (card and intent readability) and **Annihilation** (the Bloom as the Shimmer, life rewritten into beautiful hybrids).

### Pillars

1. **The party is the deck.** Four characters each bring five cards, a passive and an ultimate. Composition changes the deck, the resource engines and the run plan.
2. **Ethical collection.** Every pull is earned in play. Odds, pity and history are always visible. No money, no stamina, no walls.
3. **RPG growth.** Levels, ascension, dupes and weapons make your team stronger. Hard content becomes comfortable, and deeper content opens.
4. **Readable tactics.** Card effects, enemy intents and costs are clear before you commit. The horror is in the art, never in hidden rules.
5. **Runs as temptation.** The map asks what you will pay to linger, to return, or to take a gift from the Bloom.
6. **Flesh horror at dusk.** The Bloom's soft flesh pinks glow against deep plum dark. The beauty and the horror come from the same source.

## Ethics contract

Bloomdrawn has no real-money transactions of any kind, and nothing in the game exists to create pressure to spend or to log in. These rules outrank every other section.

- **No purchases.** No paid pulls, premium currency, battle pass, cosmetics, bundles or ads-for-rewards.
- **Direct pulls.** A reward that says "1 pull" is one pull. There is no gem-to-ticket conversion chain, and no other currency converts into pulls.
- **Visible odds.** Rates, pity count, guarantee state, pool contents and pull history are always on screen at the banner.
- **No walls.** No energy, stamina or daily caps. Progression systems create goals and challenges, never gates on play time.
- **No pressure.** No expiring offers, streak punishments or login chores. A character never becomes permanently unobtainable.
- **C0 is complete.** A character at zero dupes fully performs her role. Dupes deepen an investment; they never fix a broken kit.
- **Honest previews.** Every mechanical consequence (a Symptom's card, a Collapsing tile, an upgrade's cost) is shown before the player commits.

## Combat

Combat is turn-based against visible enemy intents: you get 6 Mana and a 5-card hand drawn from the party's shared deck, and you usually afford two or three cards a turn. All numbers in this section are starting values for tuning.

### The turn

1. **Turn start.** Party Shield clears. Mana refills to its maximum (6 base). Start-of-turn effects resolve. Draw up to 5 cards in hand.
2. **Action.** Play cards, fire ready ultimates, inspect anything. Each action resolves fully before the next.
3. **Cleanup.** Unplayed cards are discarded unless they Retain. Held Rituals get 1 cheaper.
4. **End of turn.** Scheduled effects fire, then all Tentacles attack, then damage-over-time ticks.
5. **Enemy phase.** Enemies act one at a time, in slot order, exactly as their intents showed. Then new intents are revealed.

There are no extra turns or bonus action phases. Effects can refund Mana, draw, discount or delay enemies, but the turn structure never changes.

### Mana, hand and deck

- **Mana:** 6 base, raised by relics, passives and builds. Unspent Mana is lost at refill.
- **Hand:** draw to 5 at turn start (retained cards count). Maximum hand 10; draws beyond it stay in the deck.
- **Deck:** 20 starting cards (4 characters × 5). The discard pile reshuffles only when a draw needs it.
- **Graveyard:** exhausted cards leave combat entirely.

| Personal card | Cost | Purpose |
| --- | --- | --- |
| Strike | 1 | Damage scaled by the owner's Attack; charges her ultimate |
| Defense | 1 | Shield scaled by the owner's Defense; charges her ultimate |
| Transcend | 3–5 | Once per combat; upgrades the owner and charges her ultimate heavily |
| Flavour A | 2–5 | The character's Domain engine card |
| Flavour B | 2–5 | A second engine, payoff or utility card |

### Survival

The party shares one HP pool, equal to the sum of the four characters' Max HP. Current HP carries between fights; Shield does not. A shared bar shows incoming damage from all visible intents, marked Safe when Shield covers it and with a skull when it is lethal.

### Launch statuses

| Status | Effect |
| --- | --- |
| Bleed | Damage equal to stacks at the afflicted side's end of turn, then −1 stack |
| Poison | Damage equal to stacks at end of turn, blocked by Shield; does not decay on its own |
| Vulnerable | Takes 50% more damage for N turns |
| Weak | Deals 25% less damage for N turns |
| Stun | Skips its next action |
| Delay | Skips its next action; its shown intent carries over to next turn |
| Falter | What a resisted Stun or Delay becomes on elites and bosses: the enemy acts at 25% reduced output |

Enemy intents always show the exact action and number. Random targets are labelled as random, and previews use the same rules code as resolution.

## Domains

Every character belongs to one of four Domains, and each Domain is its own combat engine. Resources are pooled per Domain across the party, so two Flesh characters share one Embryo pool.

| Domain | Morimens parallel | Resource | Builders | Payoff | Scales by |
| --- | --- | --- | --- | --- | --- |
| Flesh | Caro | Embryo | Generate Embryo | Spenders: a basic effect, plus a bonus effect when Embryo is consumed; damage over time | Build/spend rhythm and DoT stacks |
| Rapture | Aequor | Tentacles + damage per hit | Add Tentacles | Every Tentacle attacks at end of turn; spenders trigger extra mid-turn volleys | Count × damage (2 × 30 grows to 10 × 300) |
| Spirit | Original | Essence | Generate Essence | Ritual cards: expensive, Retain, 1 cheaper each turn held, scale hard with Essence | Essence and time held |
| Unbound | Chaos | None | — | Buffs, debuffs, Mana and draw economy, control and cost changes | The engines of the Domains it supports |

### Rules per Domain

- **Flesh.** A spender never consumes Embryo unless its bonus effect actually resolves. Bleed and Poison are Flesh's damage over time. Support characters add Embryo generation, card duplication and ultimate charge.
- **Rapture.** Mid-turn volleys do not consume Tentacles. Volleys hit the lowest-HP enemy first, and excess damage carries to the next.
- **Spirit.** Spirit does not normally spend Essence; a character may break this as her defining exception. The decision is to fire a Ritual now at full cost, or hold it and fire cheaper later while it occupies a hand slot.
- **Unbound.** No resource and no shared mechanic. Unbound characters are designed to slot into any team and make another Domain's engine better.

Any composition of four is legal. Same-Domain stacking deepens one engine; mixed teams trade depth for coverage.

## Characters

A run party is exactly four unique characters. Each brings her stats, five personal cards, a passive, an ultimate and her Domain engine, and every playable character is SSR.

### What a character contributes

- **Stats:** HP, Attack, Defense. HP adds to the shared pool; Attack and Defense scale her own cards.
- **Five personal cards:** one copy each of Strike, Defense, Transcend, Flavour A and Flavour B (cost bands in Combat).
- **Passive:** always labelled as combat-scoped or run-scoped.
- **Ultimate:** a gauge from 0 to 100, fired by a deliberate confirm during the action phase. Ultimates cost no Mana unless stated.
- **Generated cards:** cards her kit creates, each declaring where it goes and whether it lasts the combat or the run.

### Ownership

Every card has an owner. It reads that owner's stats, charges that owner's ultimate if it is a Strike, Defense or Transcend or its text says so, and spends from the shared Domain pool. Cards gained during a run must be assigned to an eligible owner before they enter the deck. No card is ever ownerless.

### Ultimates persist across the run

Ultimate gauges carry from fight to fight for the whole run. Spending an ultimate on a normal fight or banking it for the elite is part of routing. Cards and passives can feed gauges, and some builds are designed around firing ultimates often.

### Transcend

Transcend resolves at most once per combat and then goes to the Graveyard. It upgrades its owner's ultimate for that combat, adds heavy gauge charge, and may create a generated card. A character must still function before she Transcends.

### Bloom relationship

Every character declares how the Bloom has touched her. The Domain sets a default lean, but the choice is per character, which keeps the roster from converging.

| Relationship | Meaning | Drawn as |
| --- | --- | --- |
| Embraced | Welcomed it; it grows openly | Prominent Bloom anatomy |
| Grafted | Changed partly or against her will | One limb or patch, sutured or bound |
| Resisting | Kept out by strength, will, spirit or divine purity | No Bloom anatomy; optionally a ward, scar or burned-off shoot |
| Untouched | Unaffected, or simply human | No Bloom marks |

Leans: Flesh is almost always Embraced or Grafted. Rapture's tentacles are mandatory, but the character herself can sit anywhere. Spirit is fully open. Unbound is usually Untouched or Resisting.

**Anti-sameness rule:** within a Domain, no two characters may share all three of main silhouette feature, Bloom relationship and colour lead.

The roster is mostly adult women. Characters are designed to be desirable to collect through elegance, confidence, menace and tenderness, never through body display alone. Ages, builds, cultures and silhouettes vary deliberately.

## Launch roster

Launch ships eight characters, two per Domain. The starter four (one per Domain) are owned from the first session, so the tutorial teaches every engine. The other four enter the standard banner when banners unlock. Names marked (w) are working names.

| Character | Domain | Slot | Role | Bloom |
| --- | --- | --- | --- | --- |
| Maelia, Midwife of the Bloom | Flesh | Starter | Support/engine | Embraced |
| Agathe, the Choir-Mother | Rapture | Starter | Tentacle builder | Embraced |
| Anthe, the Sphinx's Vigil (w) | Spirit | Starter | Essence builder | Grafted |
| Leonora, the Quartermaster | Unbound | Starter | Economy | Untouched |
| Virelle, the Open Wound | Flesh | Banner | Striker | Grafted |
| Isadora, the Ecstatic | Rapture | Banner | Spender/scaler | Embraced |
| Kibane, the Nine-Tailed | Spirit | Banner | Ritual nuker | Resisting |
| Hester, the Snare-Warden (w) | Unbound | Banner | Debuff/control | Untouched |

### Kits and looks

Kits are direction, not final numbers. Each look is written as a brief an artist can draw.

- **Maelia.** *Kit:* bonus Embryo generation, ultimate charge for the party, card duplication, Poison from pollen. Ultimate consumes all Embryo for a party heal and Shield. *Look:* 40s; tall, hooded robes of layered petal-membrane with veins in the folds; brass staff ending in a glass orb with an embryo bud inside; seed pods hanging from her sleeves like rosary beads. Blush, ivory, brass.
- **Agathe.** *Kit:* Tentacle builders; starts each combat with a Tentacle; ultimate summons a burst of Tentacles. *Look:* 50s; heavy violet robes, gold-embroidered stole, censer on a chain, chalk-stained hem; flesh-pink tentacles rise from a chalk circle at her feet and coil around her raised arm. Bruise violet, green-gold, candle-wax ivory.
- **Anthe.** *Kit:* gains Essence for each Ritual held at end of turn; reduces Ritual costs; ultimate converts held turns into Essence. *Look:* 30s; Greek sphinx source; broad and regal; tawny lion ears and tail; folded feathered wings whose flowered tips are bound in gold thread; linen chiton, gold-leaf collar, a votive candle in hand. Ash, gold leaf, smoke lavender.
- **Leonora.** *Kit:* Mana now for Mana debt later, draw, next-card cost reduction; ultimate refunds the turn's Mana. *Look:* 30s; long travelling coat with a dozen pockets; brass balance scale at her hip; leather ledger with a red wax seal. Oxblood and brass.
- **Virelle.** *Kit:* applies Bleed; spenders consume Embryo to detonate Bleed stacks; ultimate is a flurry that adds Bleed per hit. *Look:* 20s; lean duelist's stance; one arm blossomed from shoulder to wrist with pink thorn-spurs at the elbow; fitted bodice laced with surgical thread. Rose, raw pink, arterial red.
- **Isadora.** *Kit:* raises damage per Tentacle; spenders trigger mid-turn volleys; ultimate makes the turn's volleys hit twice. *Look:* 20s; caught mid-dance, head thrown back; torn devotional veil, bare feet, ankle bells; four tentacles from her back arcing like ribbons, petal-tipped. Ivory, violet, green-gold.
- **Kibane.** *Kit:* holds expensive Rituals that grow huge with Essence. Her exception: her ultimate consumes all Essence for one massive hit. *Look:* 20s; pure kyubi, keeping the Bloom out by strength of spirit; fox ears and nine tails; foxfire wisps; red-and-white shrine-dancer outfit and a clawed gauntlet. No petals.
- **Hester.** *Kit:* applies Vulnerable and Weak, Delays intents; ultimate snares every enemy, skipping their next action. *Look:* 30s; wide-brimmed hat; weighted net over one shoulder; iron hooks and bone whistles on her belt. Moss, leather brown, iron.

Roster spread: ages 20s to 50s; Greek, Japanese and original sources; all four Bloom relationships. Gloomdrawn's Kibane art is a usable base without its dragon horns. Gloomdrawn's Thalassa and Nerissa are retired as designs because they are sea-coded.

## The Labyrinth

The run map is a board of hex tiles that the player roams freely, like a board game. Most tiles are just path; the rest hold fights, events, shops, camps, Symptoms or Collapsing tiles. A standard run targets 35–70 minutes and 6–10 fights.

### Tiles

| Tile | On entry | Afterwards | Advances the Bloom clock |
| --- | --- | --- | --- |
| Path | Nothing | Same | No |
| Normal | A fight | Becomes path | Yes |
| Elite | A harder fight, better reward | Becomes path | Yes |
| Boss | The final fight | Run ends | — |
| Event | A choice | Becomes path | Yes |
| Shop | Stock is revealed | Stays open; keeps its stock, prices and sold-out state all run | No |
| Camp | Use it now, or step off and keep it for later | One use; becomes path once used | Using it: yes (lean). Passing: no |
| Symptom | The exact card is shown; accept it to pass | Fires once; free to pass after | No |
| Collapsing | Nothing | Gone once you step off; shown as a ruined, impassable tile | No |

Cleared tiles never respawn, so rewards are finite and backtracking cannot farm.

### Motifs

Maps are stitched from hand-authored motifs: a main route to the Boss, with loops and branches hanging off it. A validator checks every order in which the player could use Collapsing tiles. From every reachable tile, a path to the Boss must survive, so the player can never be stranded.

### The temptation loop

The canonical side motif is a ring from the main route to a Shop and back. The first visit is free; returning costs a Symptom.

```
            Path ───────────── SHOP ───────────── Collapsing B
           /    \                                     │
  Collapsing A   Symptom                             Path
           \    /                                     │
            Path                                      │
             │                                        │
  main ── Motif entry ─────────── Path ───────────────┘
```
(Left side reaches the Shop through two parallel tiles, Collapsing A and the Symptom. Right side's only link is Collapsing B.)

First visit: in through one Collapsing tile, out through the other, each vanishing as you step off. On any return, the Symptom is the only way back to the Shop. Taking the Symptom on the way in pays the toll early and keeps both Collapsing tiles.

### Fog of war

- The path's layout is revealed within 3 tiles of where the party has been, so the edge of the known map shows whether a tile leads on or ends.
- A tile's contents are revealed within 2 tiles.
- The map view stays centred on the party, so the board's extent never hints where the Boss is.
- Shops, Elites and the Boss are landmarks, visible from further away.
- Collapsing and Symptom tiles are always marked once revealed.

### The Bloom clock

The region blooms as the expedition lingers. Fights, Events and using a Camp advance the clock; walking, shopping and Symptoms do not. Each stage is shown on the map itself.

| Stage | On the map | Effect (direction) |
| --- | --- | --- |
| Dormant | Buds hidden in walls | Baseline |
| Seeded | Pale shoots between tiles | Enemies stronger; richer rewards |
| Rooted | Veins across the floor | Stronger again; rarer Events appear |
| Flowering | Petals open across rooms | Elite-grade threats; best rewards |
| Fruiting | Pods swell and burst | Severe pressure to finish the run |

The number of clock ticks per stage and exact effects are open for tuning.

## Enemies and encounters

Enemies are things the Bloom has taken, fought in three tiers, and they visibly bloom further as the clock advances.

| Tier | Shape | Rule |
| --- | --- | --- |
| Normal | 1–3 enemies, simple patterns | Modest Obols and a card reward |
| Elite | One elite or a coordinated group; each tests one thing (heavy Shield, punishing slow setups, swarming) | Better rewards, including a relic; tests, never hard counters to a whole Domain |
| Boss | Phases with telegraphed transitions; control resistance | Ends the run; never relies on hidden instant-kills or unexplained immunity |

### Roles

Encounters mix five roles so that reading intents matters: **attacker**, **defender**, **buffer**, **debuffer** and **summoner**. A summoned enemy joins the turn order next round unless its summon says otherwise.

### Who they are

- Wildlife, livestock and villagers of the region.
- Members of earlier expeditions, still in their packs, lanterns and survey coats.
- Bloom cultists: Rapture's dark mirror, in robes with censers.
- Plants that move: root-mats, pod-throwers, petal-walls.

### Bloom-stage overlays

Each enemy has base art plus overlays for the later clock stages. A hound at Seeded has a few pale shoots along its spine; at Flowering its ribs have opened into petals. Danger reads at a glance, the clock teaches itself, and each base sprite yields several variants.

### Layout

Enemies stand on the right of the stage, the party on the left. Independently targetable enemies never overlap their bodies, target areas, HP or intent labels. Bosses take a large anchor, with adds in side lanes.

## Run economy and rewards

Inside a run the player earns Obols, cards, relics and Symptoms. All of them vanish at run end except profile rewards, which are banked.

- **Obols:** run-only currency, earned from first clears of fights, Events and the Boss. It is finite, because cleared tiles never respawn.
- **Shops:** stock and prices are fixed by the run seed when first revealed, then persist all run. A premium relic may be unaffordable on first visit by design, which is what makes the temptation loop work. No selling and no infinite loops.
- **Card rewards:** offered from pools for the party's Domains and characters. A generic Domain card must be assigned to an eligible owner, and the preview shows its numbers with that owner's stats.
- **Relics:** run-scoped items with clear triggers, in Common, Uncommon, Rare and Cursed tiers. They create build direction, such as more Mana, hand manipulation or ultimate feeding, more than flat stats.
- **Symptoms:** cards with both a real benefit and a real cost, taken at Symptom tiles. The drawback must matter in ordinary play; some builds will seek them out.
- **Curses:** purely harmful run cards, removed only by a named service.
- **Camps:** one use each. Options include healing a share of max HP, removing a Curse, treating a Symptom, or another authored choice.

### Banking at run end

| Outcome | Banked to profile |
| --- | --- |
| Victory | All profile rewards marked during the run |
| Defeat or abandon | A reduced, non-zero share, scaled by depth and progress |

Never banked: Obols, run cards, relics, Symptoms, Curses or run HP. Always eligible: pulls, EXP items, ascension materials, weapon materials and profile money.

## Meta progression

Bloomdrawn keeps a Morimens-style RPG layer: characters level, ascend, take dupes and wield weapons, so the player can out-grow hard content and push deeper. Nothing in it is gated by time or energy.

### Systems

| System | How it works | Why it exists |
| --- | --- | --- |
| Character level | Spend EXP items plus profile money | Stats grow; teams get stronger |
| EXP bank | EXP items in three tiers accumulate passively from all play; low tiers cover early levels and refund excess | A newly pulled character can be levelled at once, with no regrinding |
| Ascension | Every 10 levels needs Domain materials plus money | Build checks and challenges between bands |
| Skill levels | Skill items level each personal card, the ultimate and the passive individually; levels raise numbers only, with mechanical changes reserved for bespoke kit designs | Targeted investment in a favourite |
| Character dupes | C1–C5: passive, stats, a Flavour card, ultimate, a capstone. Overflow converts to profile-shop currency | Pull sink; vertical investment |
| Weapons | One per character; SSR, SR or R; level, ascend and dupe from +0 to +5. Signature weapons are SSR | Pull sink; stats and build options |
| Gear | Six slots, set bonuses, main stats, substats, rerolls | Deep build tuning; recommended for a later phase |
| Profile level | Earned from runs, Trials and milestones; caps the roster's character level | Paces raw power behind real play |

Materials drop from ordinary runs, scaled by depth. **Trials** are optional boss challenges that let the player target a specific material. No material has a single mandatory source.

### Depth tiers

The player chooses a run depth, and each depth names a recommended power band. Enemy stats and rewards scale with depth. Out-statting an earlier depth is intended progression: today's hard tier becomes tomorrow's comfortable one, and the next tier opens. Encounters are tuned against power bands, so the band table is a core balance artefact.

### Profile Shop

A persistent shop spending profile money and dupe-overflow currency on targeted dupes, weapons, EXP and materials. It never sells pulls, and no currency converts into pulls.

## Gacha

Pulls are earned only, spent one-for-one on banners with fully visible odds, pity and history. Pity guarantees at least three SSRs per 90 pulls, one of them the featured character.

### Banners

- **Standard:** a permanent pool of all generally released characters and non-limited weapons.
- **Featured:** a rotating rate-up on one character. Featured pity and guarantee carry over when the banner rotates; they never expire.
- **Weapon-focused:** only once weapon rates and guarantees are approved.

### Rates and pity

| Rule | Value |
| --- | --- |
| SSR / SR / R | 3% / 15% / 82% |
| Soft pity | None; a flat 3% until the pull-30 guarantee |
| Hard pity (guaranteed SSR) | Pull 30; the counter resets on every SSR |
| Featured SSR | 50/50 at each SSR; after two losses the next SSR is guaranteed featured. Worst case: SSRs at pulls 30, 60 and 90, the third being the featured character. The loss count resets when she is obtained |
| Ten-pull | At least one SR or better |
| Pity families | Featured and Standard track separately |

### Results

Every result shows its rarity and its family: SSR character, SSR signature weapon, SR or R weapon, or a material. Characters are always SSR. New characters, signature weapons and locked items are never auto-discarded; optional auto-discard converts eligible low results into Profile Shop currency.

### Pull sources

Tutorial completion (enough for an early multi-pull), run milestones, boss clears, first clears of Trials, profile levels, and collection milestones. No daily chores.

### Audit

Every pull records banner, pity and guarantee before and after, the result, dupe handling and the pull count before and after. Recent history is visible in-game. Gacha randomness uses its own seeded stream and never touches run randomness.

## Identity and art direction

Every art note in this project must be drawable: a concrete noun, a material, a body part or prop, and a colour. If a sentence cannot be drawn, it does not go in the doc.

### The Bloom

- **Vines and tendrils:** flesh-coloured (blush, salmon, raw pink) with visible muscle striation; arterial red in the folds.
- **Petals:** layered and ornate like peony, rose or lotus, but made of skin or membrane; veins show through; cream or ivory edges.
- **Centres:** where the horror sits — a stamen ending in small teeth, or a wet red heart. Used sparingly.
- **Roots:** capillary networks spreading through stone, cloth and skin.
- **Pollen:** pale, warm motes. **Sap:** blood-pink.

Pastel subjects on dusk grounds: the Bloom, the characters and the petals keep their soft flesh pinks, ivories and lavenders, set against deep plum, aubergine and charcoal. The flesh is the light source of every scene.

### Writing and prompt rules

- **Domain names never appear in image prompts or art briefs.** Prompts are built only from visual specs, so a name cannot steer the art.
- **Banned words** in art notes and lore: shimmer, fractal, echo, refraction, mirror, liminal, cosmic, ethereal, impossible geometry, pressure, "wrongness", otherworldly.
- The Bloom roots, grafts, buds and flowers. It never "refracts".
- Lore shows consequences — what grew, what it gave, what was lost — and never explains the Bloom's origin in full.

### Domain visual specs

| Domain | Look | Colours | Never draw |
| --- | --- | --- | --- |
| Flesh | Blossoms opening from wounds; embryo buds and seed pods; petals sewn on with surgical thread; umbilical vines | Blush, rose, raw pink, ivory, arterial red | Gore without the flower, zombie rot, biomechanical parts |
| Rapture | Cult robes, hoods, veils, stoles; ritual daggers, censers, candles, chalk sigils, carved idols; flesh-vine tentacles from sleeves, hoods, backs or chalk circles | Bruise violet, sickly green-gold, candle-wax ivory | Fish, fins, scales, gills, coral, shells, anything underwater |
| Spirit | Humanoid first, with mythic parts (ears, tails, horns, wings, scale patches, claws) from one named creature source each; shrine cloth, paper talismans, bells, incense, prayer ribbons, candles | Ash grey, gold leaf, smoke lavender; spirit-fire in pale gold or blush | Full animal forms, animal heads, floating ghosts, sparkles, crystal glow |
| Unbound | Mostly human; identity carried by costume and props; an optional closed bud at a collar, clasp, hairpin or scar | Free per character, outside other Domain palettes | Space, stars, galaxies, fractals, mirrors, glitch effects, eclipses |

### Palette

| Role | Colours |
| --- | --- |
| Grounds (backgrounds, UI panels) | Charcoal plum #1E1519, aubergine #2E1E2A, dusk plum #3D2838, mauve shadow #5A3A4E |
| The Bloom and its light | Petal ivory #F6E6DC, blush #F2C4C4, flesh pink #E8A0A8, raw pink #D9767A, arterial red #8E2C3A |
| Secondary light | Lavender #B9A0D0, lilac glow #D6B8E8 |
| Ornament | Antique gold #B8955A, dark brass #8C6E43 |
| Card rules boxes | Parchment #E8DCCB with ink #2A1E22 |
| Domain accents | Flesh rose #C9566A · Rapture violet #7A4FA0 with green-gold #A8A04A · Spirit gold #C9A45A · Unbound oxblood #8A4038 |

Text on dark panels is petal ivory; text on parchment is ink. Domain colours always come with an icon or label, never colour alone.

### Art style guide

The reference set is the four OpenAI concepts from the earlier builds (the garden combat screen, the Labyrinth map, the Bloom Lash card and the Pale Matron boss screen) plus Gloomdrawn's character sprites. They are references for mood and rendering only; every system, name and UI layout comes from this document.

- **Rendering:** painterly digital illustration with fine linework. Characters have anime-influenced faces and full-body, readable silhouettes.
- **Light:** the Bloom is the light source. Pink and lilac glow comes off flesh, petals and pods; rim light separates every figure from the dark ground. Corners fall into deep vignette.
- **Places:** gothic architecture overgrown by the Bloom — cathedral arches, rose windows, stone stairs, cracked flagstones — with flesh vines through the stonework and flowers of skin in clusters.
- **Ornament:** antique-gold gothic filigree; flesh-vine borders with seed pods; the occasional small eye set in a flower; gem-cut cost markers; parchment rules panels.
- **UI panels:** dark plum glass with a thin antique-gold rule and filigree corners. Buttons are framed plaques, not flat rectangles.
- **Enemy template:** a recognisable creature or person remade by the Bloom. Examples from the references: a skull inside a flesh flower standing on tendrils (Blossom Devourer), a pitted seed-husk (Garden Husk), a flower bell trailing tendrils like a jellyfish (Petal Horror).

**Prompt stem**, prefixed to every image prompt and followed by the specific brief:

> Painterly gothic fantasy illustration, fine linework, anime-influenced faces. Deep plum and charcoal background with soft vignette. Flesh-coloured vines with visible muscle striation, flowers whose petals are skin with fine veins, blush and ivory petals glowing pink and lilac as the main light source. Antique gold filigree accents. No text, no letters, no logos.

**Battle sprite stem**, used instead of the prompt stem for battle sprites, which are side-view battlers in HD pixel style. The brief gives the facing (party right, enemies left), and the art tool adds the background line:

> High-resolution pixel art battle sprite for a side-view turn-based RPG: crisp visible square pixels, clean dark outlines, a limited palette and soft cel shading. Gothic fantasy, anime-influenced face. One full-body figure in a three-quarter view, feet visible, centred, with empty margin on every side. Flesh-coloured vines with visible muscle striation, flowers whose petals are skin with fine veins, blush and ivory petals glowing pink and lilac. Antique gold filigree accents. No text, no letters, no logos, no floor, no cast shadow, no scenery.

**Never in any prompt or image:** starfields, galaxies or nebulae; underwater scenes, fish, coral or shells; crystal sparkle; neon; glitch effects; fractals or mirrors; any text baked into the image (all words are added by the game).

### Content warnings

Content with strong horror motifs carries descriptive warning tags, such as body horror, blood, surgical imagery and ritual harm. These drive an intensity setting. The tone is curiosity and unease, never cheap cruelty, and characters are treated with compassion.

## UI, feel and accessibility

The combat screen shows the party on the left, enemies on the right and a fanned hand at the bottom centre. Feel is judged by the owner playing it, never by an automated gate.

### Combat screen

- **Top left:** four portraits with ultimate gauges, Transcend state and statuses; Domain resource counters for the Domains present.
- **Party:** four full-body sprites on a diagonal from the bottom-left slot (front) to the top-right slot (back), drawn front-last so no one is hidden, with the shared HP and Shield bar under them, including incoming-damage, Safe and skull markers.
- **Top centre:** the run's relics. The Bloom clock lives on the map screen, not in combat.
- **Enemies:** right side, each with exact HP, Shield, intent and statuses.
- **Hand:** a fan around a fixed centre. Hover raises a card. Drag it up past the play line to arm it; release to cast, or pick a target for single-target cards. Drag back down, Escape or right-click cancels with nothing spent.
- **Click and keys:** every drag action also works by click and keyboard (number keys select, Enter confirms, Escape cancels).
- **Bottom corners:** Mana as current/max, the piles (draw, discard, Graveyard) and End Turn.
- **Combat log:** collapsed by default, filterable, never a permanent panel.

### Readability hooks

- **Rituals:** a Ritual tag on the card, and its cost field marks the reduction (current cost highlighted beside the printed cost).
- **Previews:** card numbers, target highlights and the incoming-damage bar come from the same rules code that resolves the play.
- **Enemy actions:** play one at a time and may be sped up, but never merged.

### Battlefield animation

Simple transforms are enough; they must never drift.

- **Idle:** every party and enemy sprite breathes with a slow scale and bob loop, offset per actor so they never move in unison.
- **Acting:** when a card is played, its owner's sprite jumps forward and returns. Enemies do the same on their action, toward the party. Hits play a short recoil on the target.
- **Home position:** each actor has a fixed home point. Every lunge is animated from home, not from wherever the sprite currently is.
- **Rapid play:** a new lunge cancels the one in flight and restarts from home, so fast card play never stacks offsets or walks a sprite across the screen.
- **Skipping:** speeding up or skipping animation never skips or reorders game results.

### Accessibility

- Readable card text at desktop and handheld resolutions; scalable text.
- No information carried by colour alone; colourblind-safe gameplay colours.
- Reduced motion, screen-shake and animation-speed settings.
- Full keyboard play and screen-reader labels.
- Plain-language rules tooltips on every keyword.

## Technical approach and build plan

Bloomdrawn is built in TypeScript as a browser-first game with a pure rules engine, by one continuous builder, with the owner playing and approving each milestone. The stack was chosen so the builder can compile, test, run and see the game in its own environment on every change.

### Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript, strict |
| Rules engine | Plain TypeScript functions in one folder; no framework, no browser APIs |
| Content | Typed TS data files validated with Zod — a broken reference is a compile error |
| UI, cards, hand, menus | React + Motion |
| Battlefield and VFX | PixiJS v8 inside the React page; React owns all input |
| Build | Vite, single package; one lint rule stops engine code importing UI |
| Tests | Vitest for rules; Playwright for smoke tests and screenshots |
| Saves | Plain versioned JSON in IndexedDB via idb-keyval, with export/import backups |
| Desktop | Tauri or Electron, decided when release is real |

### Engine rules

- **Deterministic.** The same state, seed and commands always give the same result. Every random roll uses a named, seeded stream, and gacha randomness is separate from run randomness.
- **Commands in, events out.** The UI sends a complete command; the engine accepts it with new state and ordered events, or rejects it with nothing changed.
- **One rules path.** Previews and resolution share the same code, and the UI never calculates damage, costs, targets or rewards itself.
- **No hardcoded content.** Characters, cards, enemies and tables are data; engine code reacts to effect types, never to a character's name.

### Working model

- **Planning:** one living PLAN.md (milestones, current task, "done when") and a short DECISIONS.md. A one-page design note only when a task has real unknowns.
- **Checks:** rules are proven by tests; feel is signed off by the owner playing it.
- **Hardening:** fixes real bugs found by tests or play; no open-ended audit loops.
- **Delegation:** pattern-copying chores (content entries, extra tests) may later go to cheaper models, mechanically blocked from editing tests.
- **Playable at all times:** every merge leaves the game buildable and playable.

### Milestones

Each milestone ends with the owner playing the build.

Playable first: a fight at M1, a winnable run at M4.

| Milestone | Scope |
| --- | --- |
| M0 Foundation | Project scaffold, rules engine skeleton, seeded RNG, save interface; PixiJS battlefield spike judged against Gloomdrawn |
| **M1 First fight (gate)** | Starter four against one enemy: full turn loop, all four Domain engines, drag and click hand; owner signs off feel |
| M2 Combat breadth | Enemy tiers and roles, launch statuses, Transcend, run-persistent ultimates, first relics |
| M3 The Labyrinth | Tiles, motifs, the temptation loop, fog of war, the Bloom clock, Shops, Camps and Symptoms |
| **M4 First winnable run (gate)** | Rewards, the Boss, banking, save and resume; owner wins, closes and resumes a full run |
| M5 Collection | Profile, levels, EXP bank, ascension, gacha and dupes; the four banner characters |
| M6 Depth and polish | Weapons, Trials, depth tiers, art pass, audio, accessibility, balance |
| Later | Gear, desktop packaging, more characters |

The two highlighted gates matter most: the hand must feel right at M1 before anything is built on it, and M4 is the first complete game.

## Open questions

These are deliberately undecided; each is settled before the milestone that needs it.

- [ ] Does gear ship at launch, or in a later phase? Recommendation: design now, ship later.
- [ ] How many clock ticks per Bloom stage, and the exact effects of each stage.
- [ ] Does using a Camp advance the clock? Lean: yes.
- [ ] The power-band table: recommended power and enemy scaling per depth tier.
- [ ] Reward economy: pulls, EXP and materials earned per run, depth and milestone.
- [ ] Final names for Anthe and Hester; Shiori's place (post-launch, or Spirit with a mythic source).
- [ ] Final names for Obols, pulls, profile money and item tiers.
- [ ] Content warning list and intensity settings for release.
- [ ] Decided: PixiJS for the battlefield, with React and Motion; the M0 spike checks feel only.
- [ ] Desktop wrapper (Tauri or Electron) and release platforms.
