# M6.5 The bestiary: draft for owner review

Status: **draft, 31 Oct**. Covers the new normal enemies, elites and bosses, the depths they open at, and the few enemy abilities that don't exist yet. Names, numbers and art notes are placeholders for you to mark up. Questions are numbered at the end.

## How the pools work

The 50 depths fall into five bands of ten. Each band adds its own enemies, elites and Boss.

- **A depth draws from its own band and the one before** (Q1). Depth 1–10 draws only from band 1; Depth 23 draws from bands 2 and 3.
  - Old enemies fade out, so deep runs feel different from early ones.
  - Each pool still holds about ten normal fights, four elites and two Bosses.
- **Levels are the depth's, as now.** Every number below is at level 1, on the same scale as today's enemies. The depth curve does the rest.
- **The lab fits them.** `npm run lab:depth` checks each new fight against the same targets as today's: 2–3 turns for normal fights, 5–6 for elites and 10–12 for Bosses. A single hit stays near half the party's HP or less.
- **Validation** proves that every depth from 1 to 50 has at least four normal fights, two elites and one Boss. It also proves that every enemy in a pool has a sprite.

Elites each test one thing, as DESIGN.md asks, and none hard-counters a Domain. Today's two elites test burst (the Matron's Shield) and many targets (the Hound Mother's whelps). The new ones test:
- slow setups;
- kill order;
- racing heals;
- Shield-only defence;
- racing statuses;
- a countdown;
- a thin hand.

Bosses follow the Abbess:
- two bars, with a Rouse between them;
- resists control;
- adds in the side lanes.

At Fruiting, a Boss is in Full Bloom: its second bar has a different moveset (Q2).

## Band 1, Depths 1–10: the garden and cloister

Everything today's run has, plus one flock.

| Enemy | Tier, role | HP | Intents | Art note |
|---|---|---|---|---|
| Bloom-Eyed Crow | Normal, attacker (a flock) | 30 | Peck 14; Rake 8 + 3 Bleed | A ragged black crow with a blush skin-petal flower opening from one eye socket, pale root threads trailing from its feet. Black, blush. |

**New fight:** three Crows.

## Band 2, Depths 11–20: the village

| Enemy | Tier, role | HP | Intents | Art note |
|---|---|---|---|---|
| Bellwether Ram | Normal, attacker | 140 | Paw the Ground: 12 Shield; Charge 70; Butt 30 | A shaggy grey ram with a brass bell at its throat, skin-petals sprouting through the wool on its back, curled horns wound with pale roots. Grey, brass, blush. |
| Shearer | Normal, debuffer | 60 | Snip 20 + 4 Bleed; Hamstring: party 2 Weak | A villager in a leather apron holding long iron sheep-shears, rose petals sewn along the apron hem with surgical thread. Leather brown, iron, rose. |
| Hive-Keeper | Normal, summoner | 55 | Release: summons a Bloom-Bee knot (max 2); Tend: heals the lowest-HP ally 10; Swat 26 | A beekeeper in a wide veiled hat and canvas smock, a straw skep hive under one arm with flesh-pink comb bulging out. Canvas cream, straw, flesh pink. |
| Bloom-Bee knot | Summoned | 18 | Sting 10 + 2 Poison | A fist-sized knot of six fat bees whose wings are blush skin-petals. Amber, black, blush. |
| **Plough-Hand and Ox** | Elite pair (tests kill order) | 260 and 560 | Plough-Hand: Yoke, 35 Shield to every enemy; Goad 30. Ox: Gore 50; Trample 45 + 2 Vulnerable. Both resist control. | A farmer in a straw hat holding an iron goad. Beside the farmer, a huge brown ox in a wooden yoke, its hide split along the flank where ribs of skin-petals open. Brown, straw, blush. |
| **The Miller** | Elite (tests slow setups) | 800 | Grind 25, Grind 40, Grind 55, Millrace 95, then from the start. Resists control. | A miller in a flour-white smock grown into a millstone, the stone set in the chest, a wooden mill-wheel rising behind on root-arms. Flour white, grey stone, raw pink. |
| **The Harvest Effigy** | Boss | 1,050, then 1,050 | *Standing:* Scythe Sweep 58; Binding Twine, party 2 Weak; Call the Gleaners, 2 Gleaners (110 HP, Sheaf Blow 22). *Rouse:* Threshing. *Threshing:* Flail 26 ×3; Chaff, party 2 Vulnerable; Threshing Floor 105. *Full Bloom, second bar:* Gone to Seed, summons 3 Seedlings; Flail 26 ×4; Seed-Fall 115. | A towering harvest figure of bound wheat sheaves on a wooden pole, a long iron scythe in its straw arms, a face of stretched blush skin under a straw hat, red ribbons tied at the wrists. Gold straw, iron, blush, red. Gleaner: a stooped villager in a sackcloth hood carrying a sheaf of wheat bound with pale roots. |

**New fights:** the Ram alone; Shearer and Hive-Keeper; two Shearers; Hound and Hive-Keeper.

## Band 3, Depths 21–30: the lost expedition

| Enemy | Tier, role | HP | Intents | Art note |
|---|---|---|---|---|
| Pack Porter | Normal, defender | 150 | Brace: 15 Shield; Shoulder the Load: 8 Shield to every enemy; Pack Swing 40 | An expedition porter bent under a towering canvas pack that has swollen into a ribbed seed pod, a coil of rope over one shoulder. Canvas tan, ivory pod, rope brown. |
| Field Surgeon | Normal, buffer | 60 | Suture: heals the lowest-HP ally 12; Lancet 22 + 5 Bleed | An expedition surgeon in a stained oxblood coat and leather apron holding a steel lancet, a doctor's bag hanging open with pale shoots growing out. Oxblood, steel, ivory. |
| Cartographer | Normal, debuffer | 55 | Survey: party 2 Vulnerable; Compass Point 30; Wrong Turn: you draw 1 fewer next turn (Q3) | An expedition mapmaker in a survey coat with a brass compass on a chain, a rolled map whose paper has grown blush skin-petals at the edges. Survey green, brass, blush. |
| **The Quartermaster** | Elite (tests racing heals) | 900 | Ration: heals itself 60; Cleaver 55; Ration; Strongbox, 40 Shield. Resists control. | A broad quartermaster in a leather greatcoat with a butcher's cleaver, an iron strongbox chained to the belt, ration tins sprouting pale roots. Leather brown, iron, ivory. |
| **Sapper Crew** | Elite pair (tests Shield-only defence) | 300 each | Pick Strike 40, ignoring Shield (Q4); Dig In, 30 Shield; Blasting Charge 60. Both resist control. | An expedition sapper in a leather helmet and canvas coat, a steel pick raised, a satchel of clay charges at the hip with flesh-vines through the straps. Canvas tan, steel, clay red. |
| **The Lost Captain** | Boss | 1,050, then 1,050 | *Muster:* Sabre 60; Survey Line, party 2 Vulnerable; Call the Porters, 2 Pack Porters. *Rouse:* Plant the Flag. *Last Camp:* Sabre 35 ×2; Flare, party 2 Weak; Last Stand 105. *Full Bloom, second bar:* Overgrown Camp, 40 Shield to every enemy; Sabre 35 ×3; Tent-Pole Crush 115. | An expedition captain in a long oxblood survey coat with brass buttons, a curved sabre in one hand and a torn flag on a pole in the other, the flag cloth grown into skin-petals. Roots climb the boots to the knee. Oxblood, brass, blush. |

**New fights:** the Porter and the Surgeon; the Cartographer and the Surgeon; the Porter and two Crows; the Cartographer and the Shearer.

## Band 4, Depths 31–40: the cathedral

| Enemy | Tier, role | HP | Intents | Art note |
|---|---|---|---|---|
| Grafted Gargoyle | Normal, attacker | 130 | Talons 22 ×2; Perch, 15 Shield; Dive 55 | A crouching stone gargoyle with bat wings, blush skin-petals opening in the cracks of its grey stone, moss on the shoulders. Grey stone, moss green, blush. |
| Thurifer | Normal, debuffer | 65 | Smoke: party 6 Poison; Chain Swing 30; Incense, party 2 Weak | A tall cult server in bruise-violet robes swinging a long brass thurible on a chain, green-gold smoke pouring out, a veil of ivory lace over the face. Violet, brass, green-gold. |
| Reliquary Bearer | Normal, defender | 160 | Raise the Relic: 15 Shield to every enemy; Reliquary Blow 35 | A hooded cult bearer holding a gilded reliquary box above the head, a dried flower inside behind glass, pale roots coming out of the hinges. Violet, antique gold, ivory. |
| **The Deacon** (with two Censer Acolytes) | Elite group (tests kill order) | 480, plus 50 each | Deacon: Benediction, 30 Shield to every enemy; Crozier 55. Resists control. The Acolytes are today's. | A cult deacon in ivory vestments with a bruise-violet stole, holding a short brass crozier, flesh-pink vines wound around both forearms. Ivory, violet, brass. |
| **The Organist** | Elite (tests a thin hand) | 850 | Discord: you draw 1 fewer next turn (Q3); Low Note 60; Discord; Swell 95. Resists control. | A gaunt organist on a bench at a small brass pipe organ, the pipes grown into hollow flesh-stems, long fingers on yellowed ivory keys. Brass, ivory, raw pink. |
| **The Bellringer** | Boss | 1,100, then 1,100 | *The Hour:* Toll, party 2 Weak; Bronze Swing 62; Call the Ropes, 2 Rope-Pullers (110 HP, Haul 20 Shield to every enemy, Rope Lash 22). *Rouse:* The Rope Breaks. *Fallen Bell:* Clangour 28 ×3; Crack, party 2 Vulnerable; The Last Peal 105. *Full Bloom, second bar:* Ringing Wound, party 5 Bleed; Clangour 28 ×4; The Last Peal 120. | A bell-ringer grown into a great cracked bronze bell, head and shoulders out of its crown, arms gripping thick bell-ropes that turn into flesh-vines, blush petals in the crack. Bronze, rope brown, blush. Rope-Puller: a hooded cultist in violet hauling on a rope that grows from the floor. |

**New fights:** the Gargoyle alone; the Thurifer and the Reliquary Bearer; the Gargoyle and the Thurifer; two Thurifers.

## Band 5, Depths 41–50: the root-heart

These are the three enemy templates in DESIGN.md's style guide, brought into the game.

| Enemy | Tier, role | HP | Intents | Art note |
|---|---|---|---|---|
| Blossom Devourer | Normal, attacker | 150 | Gnash 50; Engulf 30, then heals itself 20 | A pale skull held inside a large open flesh flower, standing on four thick pale tendrils. Ivory bone, raw pink, blush. |
| Garden Husk | Normal, countdown | 90 | Harden, 20 Shield; Ripen; Burst 90, then it withers and dies (Q5) | A pitted brown seed-husk the size of a barrel on short root-legs, a split down the front showing raw-pink flesh. Husk brown, raw pink. |
| Petal Horror | Normal, debuffer | 70 | Pollen Veil: party 2 Weak + 5 Poison; Tendril Lash 30; Spore-Fall, party 2 Vulnerable | A hanging bell-shaped flower the size of a person, its skin petals veined, standing on long thin pale tendrils that trail on the ground. Blush, lilac, ivory. |
| **The Grafted Stag** | Elite (tests racing statuses) | 850 | Antler Gore 55 + 10 Bleed; Shed Petals, party 8 Poison; Bellow, party 2 Weak. Resists control. | A huge red deer stag whose antlers are thorned rose branches in bloom, skin-petals opening along its throat. Russet, rose, thorn green. |
| **The Seed-Mother** | Elite (tests a countdown) | 700 | Sow, 2 Garden Husks (max 2); Root Slam 50; Nurture, 20 Shield to every enemy. Resists control. | A tall figure of woven roots carrying seed-husks in a sling across her chest like infants, a crown of ivory lilies. Root brown, ivory, raw pink. |
| **The Mother Root** | Boss | 1,150, then 1,150 | *Beating:* Pulse, party 8 Poison; Root Spear 65; Grow, 2 Petal Horrors. *Rouse:* Opening. *Flowering Heart:* Petal Storm 22 ×4; Pollen Breath, party 2 Weak and 2 Vulnerable; Heartbloom 110. *Full Bloom, second bar:* Fruit, 2 Garden Husks; Petal Storm 22 ×5; Heartbloom 125. | A huge knot of thick roots shaped like a heart, set in a cracked stone font, its surface skin with fine veins, blush flowers opening across it. Root brown, raw pink, grey stone. |

**New fights:** the Devourer alone; the Husk and the Petal Horror; two Husks and a Crow; the Devourer and the Petal Horror.

## The count, and the art

| Band | New normal enemies | New elites | Boss |
|---|---|---|---|
| 1 | 1 | 0 | the Abbess |
| 2 | 3, and a summon | 2 | the Harvest Effigy, with the Gleaner |
| 3 | 3 | 2 | the Lost Captain |
| 4 | 3 | 2 (one reuses the Acolyte) | the Bellringer, with the Rope-Puller |
| 5 | 3 | 2 | the Mother Root |

That makes 29 new sprites. I'd build and draw one band at a time (Q6). Each band is one commit with its enemies, scenario tests, art sheet and fights. You pick that band's sheet before the next band starts.

The run Bosses stay away from the Domain looks (cult hood, kitsune, surgery, costume), so the four Trial bosses in M6.7 can be the most thematic of each.

## New abilities

Most enemies use only abilities that already exist. Four don't:

- **Wrong Turn and Discord**, "you draw 1 fewer next turn": the rule exists for cards. The intent needs its label and preview.
- **Pick Strike**, "ignores Shield": the rule exists for damage. The intent needs to say so.
- **Burst, then withers**: the enemy loses all its HP after acting, and the intent says so.
- **Full Bloom forms of the new Bosses**: no new rule. Each is a second encounter, as with the Abbess.

None of them is hidden. Each is in the intent text before the player commits.

## Questions

1. **Pools.** Should a depth draw from its own band and the one before (my pick)? The alternatives are every opened band, or its own band alone.
2. **Full Bloom.** Should each new Boss's Full Bloom be a different second bar, as the Abbess has (my pick), or a third bar?
3. **A thinner hand.** May enemies make you draw 1 fewer next turn (the Cartographer and the Organist)? If not, those two get a Weak or a hit instead.
4. **Ignoring Shield.** May an enemy hit ignore Shield, shown on its intent (the Sapper Crew)? If not, the Crew tests something else.
5. **Withering.** May an enemy kill itself with its own Burst (the Garden Husk)? If not, the Husk bursts and keeps cycling.
6. **Order.** Should I build one band at a time, with you picking each band's art before the next (my pick)? The alternative is to draw all 29 sprites first.
7. **Names.** Every name here is a placeholder; rename freely.
