# M6 Scaling: how characters and enemies grow

Status: **decided by the owner, 31 Oct** (written up with Claude in the planning chat). It replaces options A and B in `m6-depth.md`, "The depth model". Items marked **decided** are settled. Items marked **recommendation** are Claude's call and the owner's to overturn. Items marked **propose** are yours to draft for the owner. Numbers marked *placeholder* are starting points for the lab, not targets to defend.

This note explains the reasons behind each rule, because that's where earlier builds went wrong. When a case isn't covered here, work out which reason applies and follow it. If two reasons conflict, ask; don't pick one silently.

## 1. The problem

The depth model (`npm run lab:depth`) found that a level-40 party has about twice the HP of a level-1 party but deals only 13% more damage. Tripling Attack's weight and doubling growth only reaches +54%.

The growth rate is not the cause. **The cause is how card numbers are written.** Every amount is *flat number + Attack*: Virelle's Strike is `6 + Attack`, and Bleed stacks are flat 6 or 9. Attack is a small add-on to a large constant, so growing Attack barely moves the total. Domain resources and statuses don't read stats at all. No growth number can fix this, because the stat hardly appears in the numbers.

## 2. The goal (owner's words, 31 Oct)

The curve should feel like **Morimens**, not a flat few-percent bump:

- A high-level party has **well over 1,000 HP** and, when very well built, deals **thousands of damage in a turn**.
- Common enemies fall fairly easily, but can do real damage if not cleared.
- At max level, **elites have pools around 10,000–20,000 HP**, and **bosses may exceed 100,000**.
- A very well-built party can combo through even these in a few turns, more so as kits are added.
- Characters grow at **different rates by role**.
- **Crit rate and crit damage** join the character stats. **An enemy must never crit**, because intents must be exact.

Read the owner's HP figures as anchors for **order of magnitude and tier ratios** (normal ≪ elite ≪ boss). They are not exact specifications. The lab produces the real numbers (section 5), the owner reacts to them, and they are tuned from there.

## 3. Why not option A or B

- **A (keep flat formulas)** leaves levels nearly meaningless for damage, so depth ends up changing only rewards and enemy lists. The owner rejected it.
- **B (a hidden level multiplier on everything a character does)** gets the curve, but it decouples output from stats:
  - If level multiplies output directly, a weapon's +Attack, a Sentinel's Defense or a relic's +Attack% barely matter.
  - Role growth would be a choice between hidden multipliers rather than visible stats.
  - Crit would have no stat-based damage to multiply.

  The owner wants depth in builds, which means stats must *be* the multiplier.

Chosen instead: **card numbers are ratios of stats, and stats grow a lot.** Every source of a stat (levels, ascension, weapons, dupes, relics) then feeds every card automatically. This is how Morimens-style games get their curve.

## 4. The rules

### 4.1 Card amounts are ratios of stats (decided)

- **Damage** is a % of the owner's **Attack**: `damage(mul(2, stat('attack')))` is "200% of Attack".
- **Shield** is a % of the owner's **Defense**.
- **Status stacks applied** are a % of the applier's **Attack** (section 4.9).
- **Heals** are a % of the **party's Max HP** (section 4.8).
- Existing multipliers stay as they are, because they already scale with the stat. Examples: Virelle's +10% per Strike played, Essence scaling, and `loseHp(mul(2, targetStacks(bleed)))`, which scales because the stacks now scale.
- **Not scaled:** Mana, costs, draw, hand size, ultimate charge, Domain resource *counts*, turn counts, and other counts. These are the game's rhythm, not its power. Scaling them would change how combat plays, not how strong a character is.

**Why:** a stat-ratio formula makes every stat source matter in proportion and keeps one rule for everything. Flat parts in damage, Shield or stack amounts are what caused the problem, so they go entirely; don't keep "a little flat base".

**Guard rail (add as a content test):** in **character, card and relic content**, every `damage`, `gainShield` and party-side `applyStatus` amount must read a stat, and every `heal` must read the party's Max HP. A bare number fails the test, with its file and ID. Enemy content is exempt, because enemies scale by level curve (section 4.10). This mechanically stops the convention from drifting back.

### 4.2 Level 1 stays as it is (decided)

Choose each ratio so that **every card's level-1 number equals today's**, within rounding. Virelle's Strike is 6 + 6 = 12 today, so it becomes 200% of 6 Attack = 12. Where a card has no stat today (for example flat Bleed 6 from a character with Attack 6), the ratio is today's number ÷ today's stat (100%).

**Why:** M1 to M4 were tuned and signed off by the owner at level 1, and that balance is the one fixed point we have. The rewrite changes how numbers *grow*, not where they *start*.

- The M4 golden replay changes anyway, because of crit and rounding. **Rebaseline it deliberately** and give the reason in the commit message. That is a fix with a reason, not weakening a test.
- Before rebaselining, print a one-off comparison of every card's level-1 number before and after, and put it in the commit message. It is not a permanent test.

### 4.3 No ×10 number rebase, for now (recommendation; the owner deferred to whichever feels better)

Keep today's scale (Strike 12 at level 1).

**Why:**
- The owner's own anchors (party "well over 1,000 HP", "thousands" of damage in a strong turn, elites 10–20k) already fit today's scale with the growth in 4.4. A ×10 would put bosses near a million, which reads as inflation rather than power.
- The dopamine comes from **growth you can see** more than from digit count:
  - Strike 12 becoming 100+;
  - crit pops at 150+;
  - Bleed in the hundreds;
  - combo turns in the thousands.
- **It is cheap to change later.** With ratio formulas, a ×10 rebase touches only the character stat tables and the enemy numbers, never a card. If the owner wants bigger numbers after playing, it is a small, safe change.

Because numbers at level 1 are small, **rounding** matters (section 4.7).

### 4.4 Stats grow a lot, with ascension steps (decided; numbers are placeholders)

- Each stat at level 40, with all three ascensions made, is about **×5 to ×9 its level-1 value**, depending on role (4.5). Weapons, dupes and relics then add to that.
- Growth comes from two sources:
  - **About 70% comes from levels**, spread evenly from 1 to 40.
  - **About 30% comes from the three ascensions**, about 10% each, applied *when she ascends* at 10, 20 and 30.

  Ascending should feel like a power spike, not just unlocking a cap.

  *Placeholder formula:* `stat = base × (1 + (M − 1) × (0.7 × (level − 1) / 39 + 0.1 × ascensions))`, where M is the role's multiplier for that stat at level 40. At level 40 with 3 ascensions this gives exactly base × M.
- Base stats (level 1) stay each character's own, as written. **The role only shapes growth.**
- C2's stat rule (`c2(STATS)`) raises base, so growth multiplies it as it does today.

**Why ×5–9:** with a mixed team, party HP goes from about 205 to about 1,450 ("well over 1,000"). Damage from stats alone grows about ×8, and crit, weapons, dupes, relics and Domain snowballs carry well-built teams into the thousands. That matches the anchors without inflation.

### 4.5 Roles set growth, and are fixed per character (decided)

Each character has exactly one **role**, written in her definition. The owner decided: **roles are fixed. There is no per-character growth override.** If a character needs different growth, she needs a different role, or a new role agreed with the owner.

Roles and their level-40 multipliers (*placeholders*, for the lab to test):

| Role | HP | Attack | Defense | Crit from ascension |
|---|---:|---:|---:|---|
| Attacker | ×6 | ×9 | ×5 | +5% rate and +10% crit damage per ascension |
| Sentinel | ×9 | ×5 | ×9 | none |
| Support | ×8 | ×6 | ×7 | none |
| Hybrid | ×7 | ×7.5 | ×7 | none |

**Why roles rather than per-character curves:**
- They give a few numbers to tune instead of one curve per character.
- They tell the player at a glance how she grows.
- They keep each character's identity in her **kit**, not her stat line.
- The role is about *stat growth*, not her Domain or job in the deck. A Support can still be a Flesh engine.

**Propose** role tags for the eight. Claude's suggestion, for the owner to approve:
- **Attacker:** Virelle, Isadora, Kibane.
- **Support:** Maelia, Leonora, Hester.
- **Hybrid:** Agathe, Anthe.
- **Sentinel:** no one yet. The first Sentinel will be a future guard or Shield kit.

### 4.6 Crit, for the party only (decided)

- **Stats:** every character has Crit Rate (5% base) and Crit Damage (+50% base, so a crit deals 150%). Attackers gain more at ascension (4.5). Weapons and relics can add more later. Crit Rate caps at 100%.
- **What can crit:** any **`damage` operation from the party**, each hit rolled separately. That includes repeats (Thousand Cuts), Tentacle volleys (end-of-turn and mid-turn) and ultimates.
- **What never crits:**
  - status ticks (Bleed, Poison);
  - `loseHp` (detonations, Open the Wound);
  - heals and Shields;
  - anything an enemy does.

  Enemies have no crit stats at all.
- **Where it sits in the modifier pipeline:** after incoming multipliers (step 4) and before Shield (step 5). A crit multiplies the hit's final damage.
- **Randomness:** a new named stream, `crit`, in combat state. Rolling crit must never shift shuffles, targeting or intents. Previews never consume it.
- **Previews:** a card shows the normal (non-crit) number. Its inspect or hover view adds "Crit: N (X%)". The lethal skull and the incoming-damage bar are unaffected, because enemies never crit.
- **Crit pops** must look clearly different on the battlefield, for example larger with a distinct colour. The owner signs off how they look.

**Why statuses and `loseHp` never crit:** status and detonation builds (Flesh) should be the *predictable* way to deal damage, and burst crits the *swingy* way. That gives Domains different feel. It also keeps detonation math readable: "loses HP equal to twice its Bleed" always means exactly that.

**Why enemies never crit:** design pillar 4. Intents show the exact number, and the player plans on it. A crit would make every intent a lie.

### 4.7 Round once, at the end (decided)

ARCHITECTURE.md currently says the pipeline rounds down "at each multiplier step". **Change that:** carry exact values through every step and **floor once** when the final amount is applied. Stats themselves stay whole numbers.

**Why:** at today's small numbers, rounding at each step eats percentage effects. 15% of 12 is 1.8, which rounds to 1, and stacked steps compound the loss. Rounding once keeps every % effect honest at every level.

### 4.8 Heals and Shields (recommendation)

- **Heals** are a % of the **party's Max HP**. Maelia's ultimate becomes "heal X% of party Max HP per Embryo consumed".
- **Shield** is a % of the **owner's Defense**, including Shield that comes per Embryo.

**Why:** party HP is one shared pool, so "heal 15% of the party's HP" reads truthfully at any level and grows with the pool automatically. Shield from Defense is what gives Defense (and Sentinels) a purpose. Choose ratios so level-1 numbers match today's.

### 4.9 Statuses (decided)

- Stacks applied by the party are a % of the **applier's Attack**, floored once.
- A tick still deals damage equal to stacks, so the status engine doesn't change.
- **Lift the stack caps.** At depth, Bleed in the hundreds is the point. Status icons must fit 4-digit stacks.
- Stacks applied by enemies follow the enemy damage curve (4.10).
- `reduceStacks(1)`-style decay stays at 1 stack per tick. That makes Bleed decay relatively slower at depth. This is acceptable and in Flesh's favour; flag it if the lab shows it breaks balance.

### 4.10 Enemies are derived from targets, not typed in (decided; targets are placeholders)

Enemy level-1 numbers stay exactly as they are. At each level, enemies scale by two curves, both **produced by the lab**:

- an **HP curve**, for HP, enemy Shield and enemy heals;
- a **damage curve**, for intent damage and the statuses enemies apply.

These replace the placeholder curve in `src/engine/levels.ts`.

The lab fits the curves to these targets against an **Average build** at that level:

| Tier | Turns to kill (Average build) | Turns to kill (Strong build, reported) | Unkilled, deals per turn |
|---|---|---|---|
| Normal fight (all its enemies) | 2–3 | about 1 | 15–25% of expected party HP |
| Elite | 5–6 | 2–3 | 25–35% |
| Boss | 10–12 | 4–5 | 40–60% on telegraphed big hits; less otherwise |

- **Average build:** party level equals depth, all ascensions due made, C0, no weapon (until weapons exist), the lab's simple player, averaged over the lab's four parties.
- **Strong build:** the same plus C2, a single-Domain team, ultimates fired, and a weapon once weapons exist.
- **Past level 40,** characters stop levelling but enemies keep climbing. Depths 41–50 are where builds (weapons, dupes, relics) carry the party. Keep `PAST_TOP` as the mechanism, at a value the lab sets.

**Why derive instead of typing HP per depth:** the owner's experience is turns and threat, not raw HP. If party power changes later (weapons, skill levels, new kits), the curves are refit instead of every table being hand-edited. Hand-typed tables drift; a fit to targets doesn't.

**The lab's output for the owner:** one table at levels 1, 10, 20, 30, 40 and 50, showing:
- party HP;
- Average and Strong damage per turn;
- enemy HP per tier (normal, elite, boss);
- enemy damage per tier.

Compare it with the owner's anchors (section 2) and say plainly where it differs. **Don't commit the curve until the owner has seen it.**

### 4.11 Domain resources (decided)

Resource **counts** stay small whole numbers: Embryo, Tentacles, Essence. (Rapture's potency is not a count; see below.) A count is a decision the player makes ("spend 2 Embryo now?"), and big counts would make that decision unreadable. What a count *does* reads Attack, so it scales.

- **Flesh:** Embryo gates bonus branches. Those branches' damage and stacks follow 4.1 and 4.9.
- **Spirit:** Essence already multiplies Attack-based damage. Remove any flat part per 4.1.
- **Rapture (decided by the owner, 31 Oct):** Rapture scales on two axes, the Tentacle count and damage per hit (`potency`). Both rise through card play.
  - **Tentacles** stay a count, a small whole number, like Embryo.
  - **Potency** stops being a count and becomes a **stored damage amount**, like status stacks (4.9). A Tentacle hit deals exactly the current potency, through the modifier pipeline, and can crit (4.6).
  - **Its starting value** is a % of the **party's average Attack**, taken once at combat start from fielded stats (level, ascension, dupes and later weapons), before any combat buffs. Choose the % so the starter party's level-1 start matches today's 3.
  - **Each potency gain on a card** is a % of **that card owner's Attack at the moment it resolves**, added to the stored value. Choose each % so level-1 gains match today's.
  - **Why the owner's Attack at the moment of play:** it's the same rule as status stacks. A stored damage amount is filled from the source's Attack when it's gained, and never recomputed. It makes sequencing a skill: an Attack buff played before a potency card pumps the Tentacles for the rest of the combat. That's intended. Don't "fix" it.
  - **Why the party average for the start:** the Tentacles belong to the party, not one character. A mixed team starts a little lower than a Rapture-heavy one, which is fair for a team that invested less.
  - **Rounding:** potency is a damage amount, so it follows 4.7. Store it exactly, show it rounded on the HUD and in card text, and floor it once per hit. Rounding each gain would erase gains at level 1, where 17% of an Attack of 5 is 0.85.
  - **Temporary gains** (such as Censer Rite's "until end of turn") must remove the exact amount they added, as recorded when gained. Never recompute it from current Attack, which may have changed.
  - Isadora's multipliers on Tentacle damage apply to hits as modifiers, as now.

### 4.12 Relics and buffs become percentages (decided)

Flat bonuses ("+3 damage", "+4 Shield") vanish at depth. Rewrite them as percentages ("+15% damage", "+10% Attack") or as stat ratios. Mana, draw, cost and count relics stay as they are (4.1).

## 5. What not to infer

Each of these is wrong for a stated reason. If one looks tempting, re-read the reason or ask.

- **Don't** add a hidden level multiplier anywhere (section 3). Power must flow through stats.
- **Don't** scale Mana, costs, draw, hand size, ultimate charge or resource counts with level (4.1, 4.11).
- **Don't** keep "a small flat base" in damage, Shield or stack formulas (4.1). The guard-rail test should fail it.
- **Don't** change level-1 numbers beyond rounding (4.2).
- **Don't** give a character her own growth curve (4.5). Roles are fixed.
- **Don't** let anything an enemy does crit or vary from its shown intent (4.6).
- **Don't** let status ticks, `loseHp`, heals or Shields crit (4.6).
- **Don't** hand-type enemy HP per depth or commit curves before the owner sees the lab table (4.10).
- **Don't** recompute stored damage amounts (status stacks, Tentacle potency) from current Attack after they're gained (4.9, 4.11).
- **Don't** add other new stats now: no speed, penetration, resistances or elemental damage. Crit rate and crit damage are the only additions.
- **Don't** touch rewards, the gacha or the reward multiplier as part of this work. The reward model in `m6-depth.md` stands. If levelling costs need retuning because levels are now worth more, say so; don't change them unasked.
- **Don't** treat the owner's HP anchors as hard targets to force (section 2). Report the gap.

## 6. Work order

1. **Proposal (owner):** role tags for the eight (4.5). Everything else here is decided or a recommendation already made.
2. **Engine:**
   - role growth with ascension steps, replacing `LEVEL_GROWTH`;
   - crit stats, the `crit` stream, the roll in `damage`, and crit in previews;
   - round-once in the pipeline;
   - stack caps lifted.

   *Done when* tests prove all of the following:
   - stats at 1, 10 (before and after ascending), 20, 30 and 40 match the formula per role;
   - a crit never occurs on status ticks, `loseHp`, heals, Shields or enemy actions;
   - rolling crit doesn't shift the shuffle stream;
   - a preview never consumes the crit stream;
   - a 15% bonus on a 12-damage hit isn't lost to step rounding.
3. **Content rewrite:** every card, ultimate, passive, Transcend, dupe variant, reward card and relic moves to ratios, with level-1 parity (4.2). Add the guard-rail test (4.1).

   *Done when:*
   - the parity printout shows every level-1 number unchanged within rounding;
   - the guard-rail test passes;
   - the golden replay is rebaselined with the reason given.
4. **Lab:** the depth model with Average and Strong builds and the fitted enemy curves.

   *Done when:* the owner has seen the table (4.10) and said yes or given changes.
5. **Owner plays:**
   - a level-1 run, which should feel like it does today, plus crits;
   - a level-40 party at Depth 40 from the content lab or a dev profile.

   He judges the feel of the numbers, crit pops included. If he wants bigger digits, the ×10 rebase (4.3) is the cheap follow-up.

## 7. Docs to update in the same commits

- **DESIGN.md:**
  - RPG layer (roles, growth shape, crit);
  - Combat (crit rules; enemies never crit);
  - Characters (role per character).
- **ARCHITECTURE.md:**
  - formulas (stat ratios);
  - the pipeline (crit step, floor once);
  - levels (role growth, ascension steps);
  - RNG streams (`crit`).
- **m6-depth.md:** replace options A and B with a pointer to this note, and refresh the model table once the lab has run.
- **DECISIONS.md:** one entry for this decision, naming option C ("stats as multipliers") and the ×1 scale.
