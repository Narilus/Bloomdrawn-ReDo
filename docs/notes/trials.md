# Trials: the four bosses (M6.7)

Status: **kits approved 1 Nov** ("well designed at first glance"); built and fitted by the lab. Sprites, tiers and party settled 4 Nov; signed off 6 Nov. The rules are his (m6-direction.md B; m6-depth.md "Trials"). Numbers are level-1 placeholders that scale with the tier's level like every enemy's, fitted later by the lab. Briefs are in `art/briefs/`, and options in `art/raw/` (sheets: `art/cut/trial-*-sheet.png`).

## How a Trial runs (settled)

- Main menu → Trials → a Domain → a tier that is open → party select → one fight against the boss at the tier's level, with no map.
- Tiers at levels 10, 20, 30, 40 and 50. A win pays the Domain's material (1, 2, 3, 3, 6). A first clear gives 1 Purified Bloom (Tier 5: 3) and opens the next tier. A defeat pays nothing. Attempts are unlimited.
- A win gives 50 profile EXP, and a first clear 200 more. Built in `src/game/trials.ts`.

## The bosses

Each mirrors its Domain's engine against the party and tests one thing. All are huge, resist control and have two bars, and every Rouse clears the boss's statuses. One engine addition: an add's `leader` target, so Talismans chant into the Oracle and Marionettes Shield the Ringmaster.

Lab (`trace-tmp`, the four parties at the tier's level): 10–11 turns at Tiers 1–4, like the run Bosses (the Queen 11.4); 12.5–14 at Tier 5, where every Boss runs long against an Average build. Big hits are 40–60% of party HP.

### Flesh: The Grand Anatomist
*Look:* a towering surgeon-saint in a blood-pink gown and stitched ivory apron, six grafted arms fanned out like a halo, each holding a brass tool. She cradles a glowing seed pod of embryo buds. *Tests:* build and burst. Her Gestation is shown on her badge, and the payoff is telegraphed a turn ahead.

- **Consultation** (1,100): Incision 30 and party 6 Bleed; Gestate, she gains 3 Gestation; Suture, she heals 40 and gains 30 Shield; Delivery, 20 per Gestation, which it then spends (the intent shows the total).
- *Rouse:* Scrub In.
- **The Theatre** (1,100): Gestate (3); Incision; Gestate (3); Delivery, so twice the first bar's.
- *Fitted:* every Rouse clears the boss's statuses (DESIGN.md "Bosses"), so a first bar with no Delivery would grow Gestation for nothing; it has its own. 30 a Gestation made the second Delivery about 85% of party HP; at 20 it is about 54%.

### Rapture: The Veiled Hierophant
*Look:* a towering cult high priestess in bruise-violet vestments, arms raised in benediction, a lace veil over her eyes and her face tipped up, rapt. Candles on her shoulders, a swinging censer, and a crown of flesh tentacles opening into flowers behind her. *Tests:* count × damage, Rapture's two axes. Her Tentacles are small adds, so killing them cuts the count, and her Sermon raises the damage of every one.

- **Vespers** (1,000): Raise a Limb, 1 Tentacle (40 HP; Lash 12 every turn; 3 at most); Sermon, every enemy gains 1 Fervour (+6 damage per hit, never wears off); Censer, party 2 Weak.
- *Rouse:* The Veil Lifts (clears her own statuses; her Tentacles keep theirs).
- *Placed:* she stands in the middle back slot, so her Limbs rise in front of her and to either side, not behind her (owner, 6 Nov).
- **Compline** (1,000): Raise Two Limbs; Sermon (2 Fervour); Communion 90, which her own Fervour raises (about 48% of party HP at level 20; 70 was 39%).

### Spirit: The Kirin Oracle
*Look:* a towering shrine oracle with a kirin's gold-leafed horn, pale gold scale patches and two legs ending in hooves under ash-grey robes. A fan of paper talismans with bells hangs behind her, inside a halo of pale gold flames. *Tests:* a delayed payoff. Her Rite is named a turn ahead and grows with every talisman left standing, so kill them or race her.

- **Invocation** (1,000): Hang Talismans, 2 small Talismans (35 HP; Chant: the Oracle gains 1 Sanctity); Hoof Strike 50; Kindle, which names the Rite next turn; The Rite, 40 + 20 per Sanctity, then her Sanctity is spent.
- *Rouse:* The Horn Unveiled.
- **Ascension** (1,000): Hang Talismans; Tranquil Ward, 60 Shield; Kindle; The Rite.

### Unbound: The Ringmaster
*Look:* a towering grinning ringmaster in an oxblood tailcoat and gold-banded top hat, a closed blush bud at his ruff. He cracks a whip, with two carved marionette dancers dangling from gold strings on his fingers. *Tests:* economy. He takes your cards and your Mana, the Unbound trade turned on you, while his marionettes Shield him.

- **The Overture** (1,000): Whip Crack 45 and party 2 Vulnerable; Sleight of Hand, party draws 2 fewer next turn; Raise the Marionettes, 2 Marionettes (50 HP; Dance 20; Bow, 20 Shield to the Ringmaster).
- *Rouse:* The Main Act.
- **The Main Act** (1,000): Whip Crack; Knife-Thrower 15 ×5; Toll the House, party takes 2 Mana debt; Grand Finale 110.
- *Fitted:* in the drafted order Whip Crack's Vulnerable covered the Finale (about 78% of party HP). Now it carries the knives and wears off first, and the Mana goes the turn before the Finale.

## Settled questions

1. The four bosses: kits approved 1 Nov. Sprites (4 Nov): the Grand Anatomist 03, the Veiled Hierophant 06 (redrawn as a woman), the Kirin Oracle 06 (redrawn on two legs), the Ringmaster 03.
2. **Tiers** (owner, 4 Nov): every tier has the same moveset; only the level changes.
3. **Party** (owner, 4 Nov): any four owned characters, chosen as for an expedition.
