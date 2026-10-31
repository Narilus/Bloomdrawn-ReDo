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
| Thornback Boar | Normal, defender | 75 | Root Down, 10 Shield to every enemy; Gore 40 | large |
| Moth-Mantle | Normal, debuffer | 50 | Pollen Dust, party 2 Weak + 4 Poison; Wing Beat 30 | large |
| Litter-Mound | Normal, summoner | 130 | Shed, a Kit (max 2); Smother 34 | large |
| Kit | Summoned | 14 | Nip 14 | small |
| **Three-Throated Wolf** | Elite: slow setups | 800 | Bite 25; Bite 40; Bite 55; Three Jaws 32 ×3; then from the start. Resists control. | large |
| **Hive-Bear**, with two Bloom-Bee knots | Elite: kill order | 600; knots 70 | Bear: Maul 60; Rear Up, 30 Shield; Swipe 45. Resists control. Knots: Sting 12 + 2 Poison; Feed the Hive, 25 Shield to the Bear. | large; knots small |
| **The Gathered Beast** | Boss | 1,050, then 1,050 | *Gathered:* Trample 58; Bellow, party 2 Weak; Call the Thicket, 2 Heron-Stalks. *Rouse:* the Peony Opens. *Many Heads:* Three Heads 26 ×3; Rend, party 2 Vulnerable; Gore 105. *Full Bloom, second bar:* Brood, 2 Kits; Many Heads 26 ×4; Gore 115. | huge |

**Fights:** Heron-Stalk and Moth-Mantle; Boar and Heron-Stalk; the Litter-Mound alone; Moth-Mantle and Boar; two Heron-Stalks.

## Band 3, Depths 21–30: the Lost Expedition (remade)

Looks and story: `bestiary-direction.md` 4.2. The Boss is the man who made his crew. What he did is never told, only shown in the crew's bodies. Content warnings: body horror, surgical imagery.

| Enemy | Tier, role | HP | Intents | Size |
|---|---|---|---|---|
| Pack Porter | Normal, defender | 80 | Brace, 15 Shield; Shoulder the Load, 8 Shield to every enemy; Pack Swing 40 | large |
| Field Surgeon | Normal, buffer | 45 | Suture, heals the lowest-HP ally 12; Lancet 22 + 5 Bleed | normal |
| Cartographer | Normal, debuffer | 50 | Survey, party 2 Vulnerable; Compass Point 30; Wrong Turn, you draw 1 fewer next turn | normal |
| Tent-Walker | Normal, summoner | 140 | Open the Flap, a Seedling (max 2); Collapse 36 and 12 Shield | large |
| **The Quartermaster** | Elite: racing heals | 900 | Ration, heals itself 60; Cleaver 55; Ration; Strongbox, 40 Shield. Resists control. | large |
| **The Cocooned Scout** | Elite: timing | 750 | Cocoon, takes no damage until its next action (Q2); Unfurl 70, and it is Vulnerable until its next action; Wing Cut 45; Moth Dust, party 2 Weak. Resists control. | large |
| **The Expedition Leader** | Boss | 1,050, then 1,050 | *Muster:* Bone Saw 60; Survey, party 2 Vulnerable; Call the Crew, a Pack Porter and a Field Surgeon. *Rouse:* He Opens Himself. *Second bar:* Graft, the lowest-HP ally gains 30 Shield and heals 20; Needle Threads 24 ×3; The Last Incision 105. *Full Bloom, second bar:* Call the Crew; Graft; Graft; The Last Incision 115. | huge |

**Fights:** Porter and Surgeon; Cartographer and Surgeon; the Tent-Walker alone; Porter and Cartographer; Tent-Walker and Surgeon.

## Band 4, Depths 31–40: the Calyx (made)

Looks: `bestiary-direction.md` 4.3. This is the busiest band in the game.

| Enemy | Tier, role | HP | Intents | Size |
|---|---|---|---|---|
| Pollinator | Normal, debuffer | 50 | Pollen Cloud, party 4 Poison + 2 Weak; Sting 30. Beside the Queen, it also has Attend: 25 Shield to the Queen. | large (normal beside the Queen) |
| Gardener | Normal, buffer | 55 | Tend, heals the lowest-HP ally 12; Graft, 15 Shield to the lowest-HP ally; Prune 32 | large |
| Stilt-Grazer | Normal, attacker | 150 | Trample 60; Graze 30 | large |
| Seed-Bladder | Normal, summoner | 70 | Drop, a Seedling (max 2); Burst Spores, party 6 Poison | large |
| **The Weaver** | Elite: thin hand | 850 | Bind, you draw 1 fewer next turn; Lash 50; Bind; Reel In 95. Resists control. | large |
| **The Pollen Queen**, with two Pollinators | Elite: kill order | 650; Pollinators 90 | Queen: Crush 70; Royal Jelly, heals itself 50. Resists control. | Queen large |
| **The Crowned Pistil** | Boss | 1,100, then 1,100 | *First bar:* Pollen Fall, party 6 Poison + 2 Weak; Stamen Lash 60; Call the Pollinators, 2. *Rouse:* the Petals Part. *Second bar:* Close the Bud, 60 Shield; Open 110; Stamen Lash 28 ×3; Pollen Fall. *Full Bloom, second bar:* Close the Bud; Open 120; Call the Pollinators; Stamen Lash 28 ×4. | huge |

**Fights:** the Stilt-Grazer alone; Pollinator and Gardener; Seed-Bladder and Pollinator; Stilt-Grazer and Gardener; two Pollinators.

## Band 5, Depths 41–50: the source

As first drafted. Its art is briefed after band 4's, with the owner's design principles applied and at least band 4's detail and glow.

| Enemy | Tier, role | HP | Intents |
|---|---|---|---|
| Blossom Devourer | Normal, attacker | 150 | Gnash 50; Engulf 30, then heals itself 20 |
| Garden Husk | Normal, countdown | 90 | Harden, 20 Shield; Ripen, "Bursts next turn"; Burst 90, then it withers |
| Petal Horror | Normal, debuffer | 70 | Pollen Veil, party 2 Weak + 5 Poison; Tendril Lash 30; Spore-Fall, party 2 Vulnerable |
| **The Grafted Stag** | Elite: racing statuses | 850 | Antler Gore 55 + 10 Bleed; Shed Petals, party 8 Poison; Bellow, party 2 Weak. Resists control. |
| **The Seed-Mother** | Elite: a countdown | 700 | Sow, 2 Garden Husks (max 2); Root Slam 50; Nurture, 20 Shield to every enemy. Resists control. |
| **The Mother Root** | Boss | 1,150, then 1,150 | *Beating:* Pulse, party 8 Poison; Root Spear 65; Grow, 2 Petal Horrors. *Rouse:* Opening. *Flowering Heart:* Petal Storm 22 ×4; Pollen Breath, party 2 Weak and 2 Vulnerable; Heartbloom 110. *Full Bloom, second bar:* Fruit, 2 Garden Husks; Petal Storm 22 ×5; Heartbloom 125. |

**Fights:** the Devourer alone; Husk and Petal Horror; two Husks and a Gardener; Devourer and Petal Horror.

## New abilities

Each one shows on the intent before the player commits.

- **Draw 1 fewer next turn** (the Cartographer, the Weaver): the rule exists for cards. Enemy intents need its label and preview.
- **Shield to one ally** (Feed the Hive, Attend, Graft): Shield today goes to the enemy itself or to every enemy. This adds two targets to the existing op:
  - *the lowest-HP ally*, as heals already have;
  - *the ally with the most max HP*, which is the Bear or the Queen.
- **Burst, then withers** (the Garden Husk): after the Burst, the enemy loses all its HP. Ripen's intent says the Burst comes next.
- **Cocoon** (the Scout): reuses the Rouse's immunity, for one action in a cycle of four (Q2).
- **Vulnerable on itself** (Unfurl): an enemy applies Vulnerable to itself. The status exists; only the target is new for enemy intents.

## Prompting

I checked the owner's looks against the prompt rules (the banned words, and what never goes in an image) and against what the image model gets wrong.

- **A stem for creatures.** The battle sprite stem asks for "anime-influenced face" and "one full-body figure", which pushes faces onto beasts. A new **Enemy sprite stem** in DESIGN.md (`npm run art -- gen <name> --stem enemy`) asks instead for:
  - one bold silhouette with dense detail inside;
  - every join drawn as a seam;
  - soft glow from flesh, petals and pollen, with no glints or points of light;
  - solid bodies;
  - limbs that end in paws, talons, blades or tools, never in fingers unless the brief asks for one hand.
  
  The gold filigree is left out, because it reads as jewellery on an animal. Bands 2–5 use this stem.
- **Glowing pollen** is briefed as a soft dust or haze on a surface. Loose bright points on a dark ground turn into crystal sparkle or a starfield.
- **"See-through" parts** (the Pollinator's and the Queen's lantern abdomens, the Seed-Bladder) are briefed as *thin opaque skin lit from inside*. A see-through part asked for on a transparent background comes back as real holes in the alpha, and the stage shows through them.
- **The Seed-Bladder** as written is a floating bladder hanging from a crown of tendrils: a jellyfish, so an underwater image. I'll brief it hanging like a ripe fruit from a thick root-stalk that arches up from the ground, with the tendrils gripping the ground as roots.
- **Battle backgrounds** (the Thicket's and the Calyx's "pale pollen motes in the air"): the motes stay in soft clumps near trunks and petals, never across the dark. Otherwise the ground reads as a night sky. Backgrounds are the art pass's (M6.11) and use the painterly prompt stem.
- **Hands.** The Expedition Leader shows two: the free hand trailing root threads from its fingertips, and the saw hand. I'll brief the saw hand in a black leather glove gripping the handle, so only the free hand has drawn fingers. The Hive-Bear's paws, the Surgeon's tools and the Quartermaster's cleavers already avoid fingers.
- **Counts.** "A dozen hare heads" and "bees crawling in its fur" become noise at sprite size. I briefed "many" heads, of which about six read clearly, and "a few large bees".

## Questions

1. **Three band 2 normals sit on band 1's rung.** The Heron-Stalk, the Thornback Boar and the Moth-Mantle are each one animal with Bloom growths. That is "taken", but band 2 is "hybrid": two or three animals fused, with the joins visible. Your ladder and these three designs disagree, so I've generated both:
   - as written, and
   - with a second animal:
     - two herons fused down the breast, sharing one pair of legs, their stem-necks twisting together;
     - a boar's front half sutured to a badger's striped back half;
     - a moth with an owl's face and talons, joined at a ruff of skin-petals.
   
   Pick on the sheet, or tell me which reading of the ladder holds.
2. **Cocoon and status ticks.** The Rouse's immunity today blocks status ticks as well as damage: a rousing Boss loses nothing to Poison or Bleed. Your rule for the Scout is that statuses still tick. Options:
   - **(a)** Change the shared rule, so immunity blocks only damage and statuses tick through every Rouse. The Abbess's Rouse turn then takes its ticks. (My pick: one rule, and it matches DESIGN.md's "immune to damage".)
   - **(b)** Keep the Rouse as it is, and give the Cocoon its own damage-only immunity.

   Volleys already pass over an immune enemy to the next target, so Rapture needs no change.
3. **Repeated antlers.** The Gathered Beast's antlers of rose branches repeat the Grafted Stag's in band 5. The two never share a pool. Should either change?
