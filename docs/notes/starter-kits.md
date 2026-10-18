# Starter kits — draft for owner review (M1)

Status: **draft, not approved.** Built from the kit directions in DESIGN.md ("Kits and looks"). Names and every number are placeholders for you to mark up. Transcend cards are M2 and not drafted here.

## Shared rules this draft assumes (please confirm)

- **Ultimate charge:** every card a character owns charges her gauge by 10 when played. Gauges run 0–100; an ultimate fires at 100 by a deliberate confirm, costs no Mana, and empties the gauge.
- **Rapture:** Tentacles and damage per hit are pooled. Damage per hit starts each combat at **3**. At end of turn every Tentacle hits once: lowest-HP enemy first, overflow carries to the next. Mid-turn volleys work the same way and consume nothing.
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
| **A: Swollen Pod** | 2 | Gain 3 Embryo. Apply 2 Poison to all enemies. |
| **B: Bud Cutting** (spender) | 3 | The next card you play this turn resolves twice. Consume 2 Embryo: charge every party member's ultimate by 10. |
| **Ultimate: Birthing Bloom** | — | Consume all Embryo. The party heals 3 and gains 4 Shield per Embryo consumed. |

Covers: bonus Embryo, Poison from pollen, card duplication, party ultimate charge, and the "consume all for heal and Shield" ultimate.

## Agathe, the Choir-Mother — Rapture, Tentacle builder

| | Cost | Text |
|---|---|---|
| **Passive: First Hymn** (combat) | — | At combat start, gain 1 Tentacle. |
| **A: Call the Choir** | 2 | Gain 2 Tentacles. If you have 4 or more, draw 1 card. |
| **B: Censer Rite** | 3 | Tentacles deal +2 damage this turn. Trigger a volley. |
| **Ultimate: Hymn of the Hundred Arms** | — | Gain 3 Tentacles. |

Both Flavour cards are the ARCHITECTURE.md worked examples. The M2 Transcended ultimate adds a volley.

## Anthe, the Sphinx's Vigil (w) — Spirit, Essence builder

| | Cost | Text |
|---|---|---|
| **Passive: Vigil** (combat) | — | At end of turn, gain 1 Essence for each Ritual in hand. |
| **A: Votive Candle** (Ritual) | 5 | Deal 8 + 3 × Essence damage. |
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

**Bloom-Rib Hound** — attacker, HP 150. Intents cycle in order, each shown with its exact number:
1. **Bite:** deal 12.
2. **Bristle:** gain 10 Shield, deal 6.
3. **Maul:** deal 18.

Art note: a lean grey hound with its ribs split open into blush skin-petals, pale shoots along its spine, raw-pink gums, and a cracked leather collar.

## What these need in the engine

New operations: `gainMana`, `manaDebt`, `chargeUltimate`, `volley`, `changeCost` (Rituals and "next card costs less"), `repeatNext` (Bud Cutting), and a held-turns counter on cards. They also need the Poison status, the ultimate command, and Domain modules for Embryo, Tentacles and Essence. None of these branch on a character.

## Questions

1. Is a flat +10 charge per owned card right, or should Strike and Defense charge less than Flavour cards?
2. Should Bud Cutting's "resolves twice" also charge the copied card's owner a second time?
3. Rituals bottoming out at 0 Mana: yes, or a floor of 1?
4. Any names you want to change now? Anthe is still a working name.
