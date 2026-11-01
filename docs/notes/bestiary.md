# M6.5 The bestiary

Status: **revised 31 Oct** after the owner's review in `docs/notes/bestiary-direction.md`, which gives the reasons for every rule here. In short:
- bands 1 and 5 stay as first drafted;
- bands 2–4 are the owner's new rosters;
- the draft's village, the cathedral, the Lost Captain and the Sapper Crew are rejected.

Names, HP and damage are level-1 placeholders on today's scale; the lab fits them.

## Rules (decided)

- **Pools:** five bands of ten depths. A depth draws from its own band and the one before.
- **Levels:** a depth's enemies are at its level, as now. `npm run lab:depth` checks each band's fights against today's targets:
  - 2–3 turns for normal fights, 5–6 for elites and 10–12 for Bosses;
  - a single hit near half the party's HP or less.
- **Validation:** every depth from 1 to 50 has at least four normal fights, two elites and one Boss, and every enemy in a pool has a sprite.
- **Bosses:** two bars with a Rouse between them; resist control; adds in the side lanes. Full Bloom (at Fruiting) is a different second bar, as the Abbess's is.
- **No enemy damage ignores Shield**, ever, Trial bosses included (DESIGN.md).
- **A Burst that withers its enemy** is announced a turn ahead, blocked by Shield, under the single-hit ceiling, and cancelled by killing the enemy first. Nothing explodes on death (DESIGN.md).
- **Each band is one rung further into the Bloom** (DESIGN.md, "Who they are"): taken, hybrid, remade, made, source.
- **Order:** one band at a time. The owner picks the band's art sheet, and then I build its enemies, scenario tests and fights.

**Rejected:** the village roster (Ram, Shearer, Hive-Keeper, Plough-Hand and Ox, the Miller, the Harvest Effigy), the cathedral roster (Gargoyle, Thurifer, Reliquary Bearer, the Deacon, the Organist, the Bellringer), the Lost Captain, and the Sapper Crew with all Shield-ignoring damage.

## Band 1, Depths 1–10: taken

Today's enemies, plus one flock.

| Enemy | Tier, role | HP | Intents | Size |
|---|---|---|---|---|
| Bloom-Eyed Crow | Normal, attacker | 30 | Peck 14; Rake 8 + 3 Bleed | small |

**New fight:** three Crows. Look: a ragged black crow with a blush skin-petal flower opening from one eye socket, and pale root threads trailing from its feet.

## Band 2, Depths 11–20: the Thicket (hybrid)

Looks: `bestiary-direction.md` 4.1, briefed in `art/briefs/` (see "Prompting" below).

| Enemy | Tier, role | HP | Intents | Size |
|---|---|---|---|---|
| Heron-Stalk | Normal, attacker | 60 | Spear Strike 30; Wade, 12 Shield; Snap 52 | normal |
| Thornback Boar | Normal, defender | 70 | Root Down, 10 Shield to every enemy; Gore 40 | normal |
| Moth-Mantle | Normal, debuffer | 50 | Pollen Dust, party 2 Weak + 4 Poison; Wing Beat 30 | normal |
| Litter-Mound | Normal, summoner | 130 | Shed, a Kit (max 2); Smother 34 | normal |
| Kit | Summoned | 14 | Nip 14 | small |
| **Three-Throated Wolf** | Elite: slow setups | 800 | Bite 25; Bite 40; Bite 55; Three Jaws 32 ×3; then from the start. Resists control. | large |
| **Hive-Bear**, with two Bloom-Bee knots | Elite: kill order | 600; knots 70 | Bear: Maul 60; Rear Up, 30 Shield; Swipe 45. Resists control. Knots: Sting 12 + 2 Poison; Feed the Hive, 25 Shield to the ally with the most max HP (the Bear while it lives). | large; knots small |
| **The Gathered Beast** | Boss | 1,050, then 1,050 | *Gathered:* Trample 58; Bellow, party 2 Weak; Call the Thicket, 2 Heron-Stalks. *Rouse:* the Peony Opens. *Many Heads:* Three Heads 26 ×3; Rend, party 2 Vulnerable; Gore 90. *Full Bloom, second bar:* Brood, 2 Kits; Many Heads 26 ×4; Gore 100. | huge |

**Fights:** Heron-Stalk and Moth-Mantle; Boar and Heron-Stalk; the Litter-Mound alone; Moth-Mantle and Boar; two Heron-Stalks.

_Built 31 Oct._ The lab plays them at Depth 20 (Average build):
- normal fights take 2.6–3.0 turns;
- elites take 5.3 (Wolf) and 5.7 (Hive-Bear);
- the Gathered Beast takes 10.5, with its worst turn at 56% of party HP.

The Boss's Gore came down from 105 to 90 to get there, and the Boar's HP from 75 to 70. The wide sprites (Boar, Moth, Litter-Mound) stand at normal size, so pairs fit their two slots.

## Band 3, Depths 21–30: the Lost Expedition (remade)

Looks and story: `bestiary-direction.md` 4.2. The Boss is the man who made his crew. What he did is never told, only shown in the crew's bodies. Content warnings: body horror, surgical imagery.

| Enemy | Tier, role | HP | Intents | Size |
|---|---|---|---|---|
| Pack Porter | Normal, defender | 80 | Brace, 15 Shield; Shoulder the Load, 8 Shield to every enemy; Pack Swing 40 | large |
| Field Surgeon | Normal, buffer | 45 | Suture, heals 12: a hurt Boss or summoner first, else the ally missing the largest share of its HP, else herself; Lancet 22 + 5 Bleed | normal |
| Cartographer | Normal, debuffer | 50 | Survey, party 2 Vulnerable; Compass Point 30; Wrong Turn, you draw 1 fewer next turn | normal |
| Tent-Walker | Normal, summoner | 90 | Open the Flap, a Seedling (max 2); Collapse 36 and 12 Shield | normal |
| **The Quartermaster** | Elite: racing heals | 900 | Ration, heals itself 60; Cleaver 55; Ration; Strongbox, 40 Shield. Resists control. | large |
| **The Cocooned Scout** | Elite: timing | 750 | Cocoon, takes no damage until its next action, though statuses still tick; Unfurl 70, and it is Vulnerable until its next action; Wing Cut 45; Moth Dust, party 2 Weak. Resists control. | large |
| **The Expedition Leader** | Boss | 1,100, then 1,100 | *Muster:* Bone Saw 60; Survey, party 2 Vulnerable; Call the Crew, a Pack Porter and a Field Surgeon. *Rouse:* He Opens Himself. *Second bar (Opened):* Graft, 30 Shield and a heal of 20, both to where Suture's rule points; Needle Threads 24 ×3; The Last Incision 105. *Full Bloom, second bar:* Call the Crew; Graft; Graft; The Last Incision 115. | huge |

**Fights:** Porter and Surgeon; Cartographer and Surgeon; the Tent-Walker alone; Porter and Cartographer; Tent-Walker and Surgeon.

_Built 1 Nov._ The lab plays them at Depth 20 (Average build):
- normal fights take 2.3–3.0 turns;
- elites take 5.8 (Scout) and 6.0 (Quartermaster);
- the Expedition Leader takes 10.4, with his worst turn at 43% of party HP (after Suture's new rule).

To get there, the Leader's bars went from 1,050 to 1,100. The Tent-Walker went from 140 HP to 90, because with the Surgeon and two Seedlings its fight took 3.4 turns. The Tent-Walker's wide sprite stands at normal size, like band 2's wide ones. Call the Crew brings two different crew in one intent, so the engine now makes room for everything one intent summons. Suture first healed the lowest-HP ally, so it often had nothing to heal: the Surgeon herself was the lowest until her partner dropped below 45. The owner changed its rule (1 Nov): a hurt Boss or summoner first, then the ally missing the largest share of its HP, then herself.

## Band 4, Depths 31–40: the Calyx (made)

Looks: `bestiary-direction.md` 4.3. This is the busiest band in the game.

| Enemy | Tier, role | HP | Intents | Size |
|---|---|---|---|---|
| Pollinator | Normal, debuffer | 50 | Pollen Cloud, party 4 Poison + 2 Weak; Sting 30. Beside the Queen, it also has Attend: 25 Shield to the Queen. | large (small beside the Queen or the Pistil) |
| Gardener | Normal, buffer | 55 | Tend, heals 12, and Graft, 15 Shield, both by Suture's rule; Prune 32 | large |
| Stilt-Grazer | Normal, attacker | 125 | Trample 60; Graze 30 | large |
| Seed-Bladder | Normal, summoner | 70 | Drop, a Seedling (max 2); Burst Spores, party 6 Poison | large |
| **The Weaver** | Elite: thin hand | 850 | Bind, you draw 1 fewer next turn; Lash 50; Bind; Reel In 95. Resists control. | large |
| **The Pollen Queen**, with two Pollinators | Elite: kill order | 450; Pollinators 90 | Queen: Crush 70; Royal Jelly, heals itself 50. Resists control. | Queen large |
| **The Crowned Pistil** | Boss | 1,100, then 1,100 | *First bar:* Pollen Fall, party 6 Poison + 2 Weak; Stamen Lash 60; Call the Pollinators, 2. *Rouse:* the Petals Part. *Second bar (Parted):* Close the Bud, 60 Shield; Open 100; Stamen Lash 28 ×3; Pollen Fall. *Full Bloom, second bar:* Close the Bud; Open 110; Call the Pollinators; Stamen Lash 28 ×4. | huge |

**Fights:** the Stilt-Grazer alone; Pollinator and Gardener; Seed-Bladder and Pollinator; Stilt-Grazer and Gardener; two Pollinators.

_Built 1 Nov._ The lab plays them at Depth 40 (Average build):
- normal fights take 2.5–3.1 turns;
- elites take 5.2 (Weaver) and 5.9 (Queen);
- the Crowned Pistil takes 11.2, with her worst turn at 57% of party HP.

To get there:
- **Stilt-Grazer:** 150 HP to 125. Its fight with the Gardener still takes 3.1, because most parties win on turn 3 and one takes a fourth; lower HP barely moves it.
- **The Queen:** 650 to 450. While her Pollinators live, Royal Jelly heals back what the party deals her, and their Weak slows it, so her HP counts only after they fall.
- **The Pistil:** Open went from 110 to 100, and Full Bloom's from 120 to 110. Party Poison never wears off, and in this band it builds through her fight, so Open plus the Poison tick came to 62%.

The Pollinator art is wide. Beside a larger anchor it stands small, as the Bee Knots do beside the Bear, so it keeps clear of the party and the screen edge; the size difference also tells the Queen from her attendants. Size belongs to an enemy, so there are three Pollinators: the plain one (large), the Queen's attendant (small, 90, with Attend) and the Pistil's (small, 50). Attend goes to the ally with the most max HP, itself included, so with the Queen dead both attendants Shield the first of them.

## Band 5, Depths 41–50: the source

As first drafted. Its art is briefed after band 4's, with the owner's design principles applied and at least band 4's detail and glow.

| Enemy | Tier, role | HP | Intents |
|---|---|---|---|
| Blossom Devourer | Normal, attacker | 120 | Gnash 50; Engulf 30, then heals itself 20 |
| Garden Husk | Normal, countdown | 75 | Harden, 20 Shield; Ripen, "Bursts next turn"; Burst 90, then it withers |
| Petal Horror | Normal, debuffer | 60 | Pollen Veil, party 2 Weak + 5 Poison; Tendril Lash 30; Spore-Fall, party 2 Vulnerable |
| **The Grafted Stag** | Elite: racing statuses | 850 | Antler Gore 55 + 10 Bleed; Shed Petals, party 8 Poison; Bellow, party 2 Weak. Resists control. |
| **The Seed-Mother** | Elite: a countdown | 700 | Sow, 2 Garden Husks (max 2), the second a step behind; Root Slam 50; Nurture, 20 Shield to every enemy. Resists control. |
| **The Mother Root** | Boss | 1,150, then 1,150 | *Beating:* Pulse, party 4 Poison; Root Spear 65; Grow, 1 Petal Horror (max 2). *Rouse:* Opening. *Flowering Heart:* Pollen Breath, party 2 Weak and 1 Vulnerable; Petal Storm 18 ×4; Heartbloom 90. *Full Bloom, second bar:* Fruit, 2 Garden Husks, the second a step behind; Petal Storm 18 ×5; Heartbloom 100. |
| **The Open-Hearted Queen** | Boss; always the Boss at Depth 50 | 1,200, then 1,200 | Starts with 2 Vines. *Enthroned:* Embrace, party draws 1 fewer and she grows 1 Vine; The Vines, 24 per Vine; Bear the Court, 2 Heart-Buds, the second a step behind. *Rouse:* She Opens Her Arms (clears her Vines). *Unveiled:* Ecstasy, she grows 3 Vines; The Vines; Heartbeat, party 10 Bleed; The Last Embrace 130. *Full Bloom, second bar:* Bear the Court; Ecstasy; The Vines; The Last Embrace 145. Resists control. |
| Heart-Bud | Her brood (small) | 60 | Nourish, heals 30 by Suture's rule; Beat, party 6 Bleed |

**Fights:** the Devourer alone; Husk and Petal Horror; two Husks and a Gardener; Devourer and Petal Horror.

_Built 1 Nov,_ without the second Boss (below). The lab plays them at Depth 40 (Average build):
- normal fights take 2.6–3.1 turns;
- elites take 5.5 (Stag) and 5.8 (Seed-Mother);
- the Mother Root takes 10.5, with her worst turn at 58% of party HP.

To get there:
- **Devourer** 150 to 120, and **Petal Horror** 70 to 60. Beside a Petal Horror the Devourer comes with 90 and the **Husk** (90 to 75) with 60, as encounter overrides, or the pairs ran to 3.5 turns.
- **The Mother Root** first came to 82%. Party Poison never wears off, and her Pulse and every Petal Horror's Pollen Veil kept adding to it, to a quarter of the party's HP a turn by her second bar. On top of that, Pollen Breath's Vulnerable 2 covers her next two actions, which in a cycle of three always includes Heartbloom. So: Pulse 8 to 4; Grow brings 1 Petal Horror (2 at most), not 2; Pollen Breath gives Vulnerable 1, spent on the Petal Storm, which comes next; Petal Storm 22 to 18 a hit; Heartbloom 110 to 90, and Full Bloom's 125 to 100.

Sizes: the Husks the Seed-Mother sows, the Husks of "two Husks and a Gardener" and the Petal Horrors the Mother Root grows stand small (`enemy.sown-husk`, `enemy.grown-petal-horror`), so the anchor stands tallest. In the three-slot fight the Gardener anchors. **Ripen** names the next intent ("Burst next turn", the `foretell` op), and **Burst** ends with `wither`: the Husk loses all its HP, through its Shield. Killing it first cancels both.

**Husks stagger** (owner, 1 Nov): two Husks that arrive together Burst a turn apart. The second comes Delayed: a summon's `stagger` status for the Seed-Mother's Sow and the Mother Root's Fruit, and an encounter entry's starting `status` in "two Husks and a Gardener". The Seed-Mother's worst turn falls from 49% to 30% (6.0 turns). "Two Husks and a Gardener" now runs 3.2 turns with its Husks at 55: the Delayed Husk lives to turn 4 unless it is killed, so less HP shortens the fight no further.

**The second Boss** (owner, 1 Nov): the Mother Root alone isn't epic enough for Depth 50. **The Open-Hearted Queen** is a regal woman enthroned, grown into her throne, her heart open in her chest, vines arcing round her (sprite 01; every option kept). She never strikes for herself. She welcomes you while her Vines and her brood do the work, a Rapture snowball turned on the party: her Vines only grow, so a fight left to run gets worse every cycle. Her Vines are a status on her badge (`status.vines`, the tentacle icon), and The Vines is a `repeat` of one hit per Vine, so the intent shows "24 ×N" and Incoming counts every hit. Breaking her first bar takes away the Vines it grew. Depths 41–49 draw their Boss from the Crowned Pistil, the Mother Root and the Queen, and Depth 50 is always the Queen (a band's `finale`). The Heart-Bud's sprite is option 01, standing in until the owner picks.

_Built 1 Nov._ The lab at Depth 40 gives 11.3 turns, 12% of party HP a turn and a worst turn of 47%. As first drafted (The Vines 16 a hit, Ecstasy 2, Heartbeat 6, The Last Embrace 95 and 105, Heart-Buds of 40 HP with 4 Bleed), her worst turn was 30%: the buds fell the turn they came, and her second bar broke before her Vines grew back. So: The Vines 16 to 24; Ecstasy 2 to 3; Heartbeat 6 to 10; The Last Embrace 95 to 130, and Full Bloom's 105 to 145; Heart-Buds 40 to 60 HP, with Beat 4 to 6 Bleed.

## New abilities

Each one shows on the intent before the player commits.

- **Draw 1 fewer next turn** (the Cartographer, the Weaver): the rule exists for cards. Enemy intents need its label and preview.
- **Shield to one ally** (Feed the Hive, Attend, Graft): Shield today goes to the enemy itself or to every enemy. This adds two targets to the existing op:
  - *the lowest-HP ally*, as heals already have;
  - *the ally with the most max HP*, which is the Bear or the Queen.
- **Burst, then withers** (the Garden Husk): after the Burst, the enemy loses all its HP. Ripen's intent says the Burst comes next.
- **Cocoon** (the Scout): its own immunity to damage until its next action, for one action in a cycle of four. Statuses still land and tick; the Rouse's immunity is unchanged (owner, 31 Oct). Built 1 Nov: `status.cocooned`; volleys pass it by.
- **Vulnerable on itself** (Unfurl): an enemy applies Vulnerable to itself. The status exists; only the target is new for enemy intents.

## Prompting

I checked the owner's looks against the prompt rules (the banned words, and what never goes in an image) and against what the image model gets wrong.

- **A stem for creatures.** The battle sprite stem asks for "anime-influenced face" and "one full-body figure", which pushes faces onto beasts. A new **Enemy sprite stem** in DESIGN.md (`npm run art -- gen <name> --stem enemy`) asks instead for:
  - one bold silhouette with dense detail inside;
  - every join drawn as a seam;
  - soft glow from flesh, petals and pollen, with no glints or points of light;
  - solid bodies;
  - five fingers on every human hand, and monstrous limbs that end cleanly in paws, talons, blades or tools.
  
  The gold filigree is left out, because it reads as jewellery on an animal. Bands 2–5 use this stem.
- **Glowing pollen** is briefed as a soft dust or haze on a surface. Loose bright points on a dark ground turn into crystal sparkle or a starfield.
- **"See-through" parts** (the Pollinator's and the Queen's lantern abdomens, the Seed-Bladder) are briefed as *thin opaque skin lit from inside*. A see-through part asked for on a transparent background comes back as real holes in the alpha, and the stage shows through them.
- **The Seed-Bladder** as written is a floating bladder hanging from a crown of tendrils: a jellyfish, so an underwater image. I'll brief it hanging like a ripe fruit from a thick root-stalk that arches up from the ground, with the tendrils gripping the ground as roots.
- **Battle backgrounds** (the Thicket's and the Calyx's "pale pollen motes in the air"): the motes stay in soft clumps near trunks and petals, never across the dark. Otherwise the ground reads as a night sky. Backgrounds are the art pass's (M6.11) and use the painterly prompt stem.
- **Hands** (owner, 31 Oct: the one-hand limit is loosened): hands may show, humanoid enemies included, with care over the finger count on monstrous designs. The Expedition Leader keeps both hands as designed.
- **Counts.** "A dozen hare heads" and "bees crawling in its fur" become noise at sprite size. I briefed "many" heads, of which about six read clearly, and "a few large bees".

## Answers (owner, 31 Oct)

1. **Band 2's art:** two herons fused (Heron-Stalk), the boar and badger (Thornback Boar), the moth as written (Moth-Mantle), Litter-Mound 01, Kit 02, Three-Throated Wolf 03, Hive-Bear 03, bee knot 02, Gathered Beast 03 (every Beast option is kept in `art/raw/`).
2. **Cocoon** gets its own damage-only immunity: statuses tick and land through it. The Rouse is unchanged and still blocks status ticks.
3. **Repeated motifs** such as the antlers are fine.
4. **Hands** may show, and humanoid enemies are welcome when they have more flavour than a job or a plain man. Watch the finger count on monstrous designs.

## Answers (owner, 1 Nov)

1. **Band 3's art:** Pack Porter 02, Field Surgeon 01, Cartographer 02, Tent-Walker 01, Quartermaster 03, Cocooned Scout 01, Expedition Leader 01. Every option is kept in `art/raw/`.
2. **The Tent-Walker's flap-mouth** stays. It suggests anatomy without being explicit, the teeth on 01 help, and the band carries content warnings. The owner will keep an eye on it.
3. **Suture** tends a hurt Boss or summoner first (the Leader, the Tent-Walker), then the ally missing the largest share of its HP (the crew left after the Boss dies), and herself last. Only hurt allies count, so a whole Boss is passed over.
4. **Every enemy heal uses Suture's rule:** the Lantern Surveyor's Tend, the Leader's Graft (its Shield goes with the heal) and the Gardener's Tend and Graft.
5. **Band 4's art:** Pollinator 01, Gardener 01, Stilt-Grazer 01, Seed-Bladder 02, Weaver 03, Pollen Queen 03, Crowned Pistil 02. Every option is kept in `art/raw/`.
6. **Band 5's art:** Blossom Devourer 01, Garden Husk 01, Petal Horror 01, Grafted Stag 01, Seed-Mother 02, Mother Root 01. Every option is kept, with Mother Root 02 and 03 mirrored to face left. The Husk's and the Mother Root's seams read as seams.
7. **Band 5 gets a second Boss,** an enthroned woman, because the Mother Root alone isn't epic enough for Depth 50.
8. **The Open-Hearted Queen:** sprite 01, every option kept, moveset as proposed. Her Vines are a counter on her, not summoned sprites.
9. **Husks stagger:** two that arrive together Burst a turn apart, and killing one cancels its Burst.
10. **Depth 50 is always the Queen;** Depths 41–49 draw from the Pistil, the Mother Root and the Queen.
