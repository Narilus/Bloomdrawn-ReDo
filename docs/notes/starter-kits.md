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
