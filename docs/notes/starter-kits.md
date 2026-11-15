# Starter kits — draft for owner review (M1)

Status: **approved by the owner, 19 Oct**, with the answers below folded in. Built from the kit directions in DESIGN.md ("Kits and looks"). Numbers are placeholders for tuning in M1–M2. Transcend cards are M2 and not drafted here.

## Shared rules

- **Ultimate charge:** Strike and Defense charge their owner's gauge by 10 when played; that gives a reason to play them over Flavour cards. Other cards charge only when their text says so. Transcend cards (M2) give a large chunk, around 30–40, since they resolve once per combat. Gauges run 0–100; an ultimate fires at 100 by a deliberate confirm, costs no Mana, and empties the gauge.
- **Rapture:** Tentacles and damage per hit are pooled. Damage per hit starts each combat at **3**, and raises to it last for the rest of the combat, so Tentacle damage ramps over the fight. At end of turn every Tentacle hits once: lowest-HP enemy first, overflow carries to the next. Mid-turn volleys work the same way and consume nothing.
- **Spirit Rituals:** Retain. At cleanup each held Ritual costs 1 less, to a minimum of 0. Its cost field shows the printed cost and the current one.
- **Mana debt:** debt is taken off the next turn's refill, never below 0 Mana, and shows in the Mana orb.
- **Poison:** damage equal to stacks at the afflicted side's end of turn; it does not decay (DESIGN.md).

## Stats (placeholder)

| | HP | Attack | Defense | Strike | Defense card |
|---|---|---|---|---|---|
| Maelia | 55 | 3 | 5 | 6 + Atk = 9 | 5 + Def = 10 Shield |
| Agathe | 50 | 4 | 4 | 10 | 9 Shield |
| Anthe | 60 | 3 | 5 | 9 | 10 Shield |
| Leonora | 45 | 5 | 3 | 11 | 8 Shield |

Party HP 210.

## Maelia, Midwife of the Bloom — Flesh, support/engine

| | Cost | Text |
|---|---|---|
| **Passive: Midwife's Hands** (combat) | — | The first time each turn a card gains Embryo, gain 1 more. |
| **Strike** | 1 | Deal 6 + Attack damage. Consume 1 Embryo: apply 4 Poison (owner, 27 Oct). |
| **A: Swollen Pod** | 2 | Gain 3 Embryo. Apply 8 Poison to all enemies (was 2; Flesh's Poison ×4, owner, 27 Oct). |
| **B: Bud Cutting** (spender) | 3 | The next card you play this turn resolves twice. Consume 2 Embryo: charge every party member's ultimate by 10. |

The repeated card charges its owner's ultimate once, not twice.
| **Ultimate: Birthing Bloom** | — | Consume all Embryo. The party heals 3 and gains 4 Shield per Embryo consumed. |

Covers: bonus Embryo, Poison from pollen, card duplication, party ultimate charge, and the "consume all for heal and Shield" ultimate.

## Agathe, the Choir-Mother — Rapture, Tentacle builder

| | Cost | Text |
|---|---|---|
| **Passive: First Hymn** (combat) | — | At combat start, gain 1 Tentacle. |
| **A: Call the Choir** | 2 | Gain 2 Tentacles. If you have 4 or more, draw 1 card. |
| **B: Censer Rite** | 3 | Tentacles deal +2 damage for the rest of combat. Trigger a volley. |
| **Ultimate: Hymn of the Hundred Arms** | — | Gain 3 Tentacles. |

Both Flavour cards are the ARCHITECTURE.md worked examples. The M2 Transcended ultimate adds a volley.

## Anthe, the Sphinx's Vigil (w) — Spirit, Essence builder

| | Cost | Text |
|---|---|---|
| **Passive: Vigil** (combat) | — | At end of turn, gain 2 Essence for each Ritual in hand (was 1; doubled after the M5.2 lab, 27 Oct). |
| **A: Votive Candle** (Ritual) | 5 | Deal 8 + 6 × Essence damage (was 3 ×; doubled after the M5.2 lab, 27 Oct). |
| **B: Gilded Thread** | 2 | Every Ritual in your hand costs 1 less. Gain 1 Essence. Draw 1 card. |
| **Ultimate: Hours Kept** | — | Gain 1 Essence for every turn your held Rituals have been held, in total. |

Votive Candle is the starter team's Ritual payoff, so Spirit's held-turn decision exists from the first fight. Anthe doesn't spend Essence; that exception belongs to Kibane.

## Leonora, the Quartermaster — Unbound, economy

| | Cost | Text |
|---|---|---|
| **Passive: Running Tab** (combat) | — | When a turn starts with Mana debt, draw 1 card. |
| **A: Promissory Note** | 2 | Gain 4 Mana. Take 2 Mana debt. |
| **B: Requisition** | 2 | Draw 2 cards. The next card you play this turn costs 2 less. |
| **Ultimate: Balance the Books** | — | Gain Mana equal to the Mana spent this turn. |

## M1 enemy (my discretion; veto freely)

**Bloom-Rib Hound** — attacker, HP 150 (225 since the owner's tuning on 27 Oct). Intents cycle in order, each shown with its exact number:
1. **Bite:** deal 12.
2. **Bristle:** gain 10 Shield, deal 6.
3. **Maul:** deal 18.

Art note: a lean grey hound with its ribs split open into blush skin-petals, pale shoots along its spine, raw-pink gums, and a cracked leather collar.

## What these need in the engine

New operations: `gainMana`, `manaDebt`, `chargeUltimate`, `volley`, `changeCost` (Rituals and "next card costs less"), `repeatNext` (Bud Cutting), and a held-turns counter on cards. They also need the Poison status, the ultimate command, and Domain modules for Embryo, Tentacles and Essence. None of these branch on a character.

## Owner's answers (19 Oct)

1. Strike and Defense charge the ultimate; other cards don't unless they say so. Transcend cards give a chunk (30–40).
2. Bud Cutting's repeat charges the copied card's owner only once.
3. Rituals bottom out at 0 Mana.
4. Names are good as they are.

Censer Rite's damage increase lasts the combat, so each cast ramps the Tentacles further.

## Potential, P1–P5 (draft for the owner, 15 Nov)

Status: **draft, waiting on the owner.** The Profile Shop (M6.9) sells the starters' dupes, but they have no Potential levels yet. These follow the banner four (`docs/notes/banner-kits.md`): P1 changes the passive, P2 the stats, P3 a Flavour card, P4 the ultimate, P5 a capstone. P2 is the shared rule (+10% HP, +3 Attack, +3 Defense). Numbers are placeholders for the lab. Every one is built from operations and triggers the engine already has.

For comparison, the banner four: Virelle P1 Opened Vein gives 2 Embryo, P3 Open the Wound's detonation is three times the Bleed, P4 Thousand Cuts hits 2 more times, P5 Bleed on enemies stops losing stacks. Hester P1 Hunter's Patience gives 3 Vulnerable, P3 Weighted Net costs 1, P4 The Snare Closes also applies 2 Vulnerable, P5 her Weak and Vulnerable last a turn longer.

### Agathe, the Choir-Mother (Rapture)

| | Now | Draft |
|---|---|---|
| P1 | First Hymn: at combat start, gain 1 Tentacle. | First Hymn gives **2** Tentacles. |
| P2 | | +10% HP, +3 Attack, +3 Defense. |
| P3 | Censer Rite costs 3. | Censer Rite costs **2**. |
| P4 | Hymn of the Hundred Arms gains 3 Tentacles (Transcended: then a volley). | Gains **5** Tentacles. |
| P5 | | First Hymn also gains **1 Tentacle at the start of each turn**. |

### Maelia, Midwife of the Bloom (Flesh)

| | Now | Draft |
|---|---|---|
| P1 | Midwife's Hands: the first time each turn a card gains Embryo, gain 1 more. | Gain **2** more. |
| P2 | | +10% HP, +3 Attack, +3 Defense. |
| P3 | Bud Cutting costs 3. | Bud Cutting costs **2**. |
| P4 | Birthing Bloom heals 1.43% of max HP and gives 0.8 × Defense Shield for each Embryo consumed. | Heals and Shields **half as much again** per Embryo. |
| P5 | | Midwife's Hands works **every time** a card gains Embryo, not only the first each turn. |

### Anthe, the Sphinx's Vigil (Spirit)

| | Now | Draft |
|---|---|---|
| P1 | Vigil: at end of turn, gain 2 Essence for each Ritual in hand. | **3** Essence for each Ritual. |
| P2 | | +10% HP, +3 Attack, +3 Defense. |
| P3 | Votive Candle deals Attack × (2.67 + 2 per Essence). | **3** per Essence (Kibane's P3 is the same kind of change). |
| P4 | Hours Kept: 1 Essence for every turn held Rituals have been held (Transcended: 2). | **2** per turn held (Transcended: **3**). |
| P5 | | When she plays a Ritual, gain **1 Essence for each turn it was held**. |

### Leonora, the Quartermaster (Unbound)

| | Now | Draft |
|---|---|---|
| P1 | Running Tab: when a turn starts with Mana debt, draw 1 card. | Draw **2**. |
| P2 | | +10% HP, +3 Attack, +3 Defense. |
| P3 | Promissory Note: gain 4 Mana, take 2 Mana debt. | Gain **5** Mana, debt unchanged. |
| P4 | Balance the Books: gain Mana equal to the Mana spent this turn (Transcended: and draw 2). | Also **draws 2** (Transcended: **4**). |
| P5 | | Running Tab also makes **the next card she plays cost 1 less**. |

### Questions

1. Are these the right directions? Change any line you like.
2. Maelia's P5 is the strongest here: with P1 every card that gains Embryo gains 2 more. Keep it and let the lab check it, or cap it (say, only the first two times each turn)?
3. Agathe's P5 adds Tentacles every turn, which stacks with Isadora's P5 (Tentacles attack twice). Fine to let the lab measure that pair once it's built?
4. Anthe's P5 and her signature weapon (Rituals deal more per turn held) both reward holding Rituals. Is that overlap welcome, or should P5 do something else?
