# M2 content and rules: draft for owner review

Status: **draft, not approved.** Covers what M2 needs that DESIGN.md leaves open: status timing, Transcend cards for the starter four, the first enemy roster, the first relics, and the gauntlet that tests run-persistent ultimates. Every number is a placeholder for you to mark up. Questions are numbered at the end.

## Statuses

DESIGN.md defines the seven launch statuses. This is how I'd make them exact.

| Status | Rule as built | Stacks |
|---|---|---|
| Bleed | Damage equal to stacks at the bearer's side's end of turn, then −1 stack. **Ignores Shield** (Q2). | Add |
| Poison | As now: damage equal to stacks, Shield blocks it, never decays. | Add |
| Vulnerable | Takes 50% more damage. | Turns; add |
| Weak | Deals 25% less damage. | Turns; add |
| Stun | Skips its next action; that intent is lost and the next one is revealed. | Once |
| Delay | Skips its next action; the same intent stays shown for next turn. | Once |
| Falter | Replaces Stun or Delay on enemies with control resistance (elites, bosses): its next action deals and shields 25% less. | Once |

**Timing (Q1).** Each side's statuses tick at the end of that side's turn:

- **Statuses on enemies** tick at the end of your turn, after the Tentacles, as Poison does now. Damage lands where you can see your setup pay off.
- **Statuses on the party** tick after the enemy phase.
- **Turn counts** (Vulnerable, Weak) drop by 1 at the same moment.

So Vulnerable 1 on the Hound helps the cards you play this turn, then ends.

**The party (Q3).** The party shares one HP pool and one Shield, so debuffs an enemy puts on the party land on the whole party:

- Weak cuts every member's damage.
- Vulnerable makes the shared pool take more.

They show on the party bar. Stun, Delay and Falter only ever affect enemies.

## Transcend

Each starter gains her fifth card, so the deck becomes 20. On play, a Transcend card:

- resolves its effect;
- charges its owner's gauge by 35;
- marks her Transcended for the rest of the combat, which swaps in her upgraded ultimate;
- then goes to the Graveyard.

It's once per combat. The portrait shows the Transcended state. Your idea of a sprite change on Transcend (Maelia-03) fits here later.

| Character | Card (cost) | Effect when played | Transcended ultimate |
|---|---|---|---|
| Maelia | **Ripened Womb** (3) | Gain 3 Embryo. Create a **Seed Pod** in hand (0 cost: gain 2 Embryo; goes to the Graveyard). | Birthing Bloom also applies Poison equal to the Embryo consumed to all enemies. |
| Agathe | **The Choir Answers** (4) | Gain 2 Tentacles. Tentacles deal +1 damage for the rest of combat. | Hymn of the Hundred Arms gains 3 Tentacles, then triggers a volley. |
| Anthe | **The Riddle Answered** (4) | Gain 2 Essence. Every Ritual in your hand costs 1 less. | Hours Kept gains 2 Essence per held turn instead of 1. |
| Leonora | **Call in the Debts** (3) | Draw 2 cards. Gain 2 Mana. | Balance the Books also draws 2 cards. |

## Enemies

These are from "Who they are" in DESIGN.md. Each one covers a role, and each needs a sprite through `npm run art` before it looks finished; until then it stands in as a dummy. Intents cycle in order unless noted.

| Enemy | Tier, role | HP | Intents | Art note |
|---|---|---|---|---|
| Bloom-Rib Hound | Normal, attacker | 150 → **70** in groups | Bite 12; Bristle 10 Shield + 6; Maul 18 | Done (Hound-02) |
| Root-Mat | Normal, defender | 60 | Thicken: 14 Shield; Lash 7; Shelter: every enemy gains 6 Shield | A knotted mat of pale roots and bark the size of a cart, blush petals in its gaps, one gnarled root raised like an arm. Bark brown, blush. |
| Censer Acolyte | Normal, debuffer | 48 | Smoke: party gains 2 Weak; Censer Swing 9; Incense: party gains 2 Vulnerable | A cultist in bruise-violet robes swinging a brass censer on a chain, smoke curling pink, a skin-petal flower sewn over the mouth. Violet, brass. |
| Pod-Thrower | Normal, summoner | 42 | Lob 7; Sow: summons a Seedling (max 2); Lob 7 | A hunched plant on a root-foot with one long arm ending in a cupped seed pod, ripe pods hanging along its back. Moss green, ivory pods. |
| Seedling | Summoned | 14 | Nip 4 | A knee-high sprout with a bud for a head and two leaf-hands, raw-pink at the root. |
| Lantern Surveyor | Normal, buffer | 52 | Tend: heals the lowest-HP ally 10; Signal: every enemy gains 5 Shield; Lantern Swing 8 | A lost expedition surveyor in an oxblood survey coat and pack, brass lantern raised, pale shoots growing from the collar. Oxblood, brass, lamp-gold. |
| **Thorn-Wall Matron** | Elite, defender (tests burst) | 160 | Wall: 25 Shield; Thorn Lash 14 (Bleed 2); Wall; Crush 22. Resists control. | A towering figure of woven thorn-stems and petal-walls, a woman's face at the crown, blush roses as shields on both arms. Thorn green, blush. |
| **Hound Mother** | Elite, swarm (tests multi-target) | 140 | Howl: summons 2 Bloom-Rib Whelps (25 HP, Bite 6); Rend 12; Howl. Resists control. | A Bloom-Rib Hound twice the size, ribs fully opened into a cage of petals, whelps' shoots trailing from its flanks. Grey, raw pink. |

**Encounters** (1–3 enemies, layout per DESIGN.md):

- **Normal:**
  - Hound alone
  - Root-Mat + Censer Acolyte
  - Pod-Thrower + Lantern Surveyor
  - Two Hounds at 70 HP
- **Elite:** each elite alone.

**Engine needs:** summoning (a new enemy joins next round, in a free side slot); heal and Shield on allies; intents that apply statuses; control resistance as a trait; a "random without repeat" pattern for later. No new rules beyond the questions below.

## Relics

These are run-scoped. They come in Common, Uncommon, Rare and Cursed. They lean toward build direction over flat stats.

| Relic | Tier | Effect |
|---|---|---|
| Brass Thimble | Common | +1 Mana on the first turn of each combat. |
| Seed Packet | Common | At combat start, gain 2 Embryo. |
| Cracked Reliquary | Uncommon | Strike and Defense charge 5 more ultimate (the battery direction you mentioned). |
| Vigil Wax | Uncommon | At turn start, if a Ritual is in hand, draw 1 card. |
| Midwife's Shears | Rare | Whenever Embryo is consumed, apply 1 Vulnerable to all enemies. |
| Choir Bell | Rare | At turn start, your Tentacles volley once (in addition to end of turn). |
| Blooming Coin | Cursed | +1 Mana every turn. At turn start, the party takes 3 damage. |

## The M2 gauntlet

The M2 build is a short run: **three fights in a row**:

1. a normal fight;
2. another normal fight;
3. an elite.

Party HP and ultimate gauges carry over, and gauges start at 0, so persistence is real. After each win you pick one relic from three. Rewards proper (cards, Obols) wait for M4; the relic pick is there so relics get tested. A loss or the elite's defeat ends the gauntlet with "Run again".

## Questions

1. Status timing as above: enemies' statuses tick at the end of your turn, the party's after the enemy phase, with turn counts dropping at the same moments?
2. Does Shield block Bleed? I'd say no, so Bleed (fading, piercing) and Poison (steady, blockable) feel different.
3. Do debuffs on the party land on the whole party, as above?
4. Buffers: Shield and heal only, as drafted, or should there be a Strength-like status (+N damage)? That isn't on the launch list.
5. The Transcend cards, enemies, encounters and relics: approve, mark up or cut?
6. The gauntlet as the M2 test: three fights, gauges from 0, a relic pick after each win?
7. Shall I generate sprite options for the six new enemies now, and portraits for the starter four, in parallel as in M0.6?
