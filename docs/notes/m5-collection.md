# M5 Collection

Status: **answered by the owner, 25 Oct** (his answers are folded in below; the choices left to me are marked "my call"). M5 adds a roster you choose a party from, the gacha, dupes, and levels with the EXP bank and ascension, plus the four banner characters. DESIGN.md sets the gacha's rates and pity and the shape of each system. This note covers what it leaves open. Numbers are placeholders for tuning.

## Names (working)

The owner wants in-universe names; these are my picks from his suggestions, until the final names (DESIGN.md, Open questions).

| Thing | Name |
|---|---|
| Pulls | **Purified Blooms** (one Bloom is one pull) |
| Profile money | **Ducats** (Obols stay the run's coin) |
| EXP items, 100 / 500 / 2,000 EXP | **Faint, Clear and Vivid Memories** |
| Ascension materials | **Flesh Sac, Rapture Tendril, Spirit Shard, Unbound Badge** |
| The "dust" from pulls | **Pollen** |

Code keeps its plain names (`pulls`, `money`); only the screens use these.

## The roster and the party

- The profile owns characters. Every profile owns the starter four, the current one included. Every character you own can be in a party.
- **Before a run, you choose any four** owned characters and their order (front first). No Domain rules: pure parties will likely synergise better, but you can mix and match (owner). The card reward pool already follows the party.
- Screens: a **Roster** (owned characters and their level, ascension and dupes), a **character page** (stats, kit, level up, ascend), the **Banner**, and **party select** before New run (team presets; owner, 26 Oct, DECISIONS.md). Each is reached from the title screen.

## The gacha

DESIGN.md fixes the rules: SSR 3%, SR 15%, R 82%; hard pity at pull 30; no soft pity; a ten-pull gives at least one SR. Odds, pity, the pool and the history are always on screen, and every pull is audited. Gacha randomness has its own seeded stream in the profile.

- **Standard banner only in M5 (owner).** Its pool is the four banner characters.
- **Featured banners, later:** no rotation and no clock. A menu lets you pick which Featured banner to pull on, freely (owner). Its 50/50 and the two-loss guarantee come with it.
- **SR and R before weapons exist** (owner): an SR gives ascension materials, and an R gives Memories and Ducats. They become weapons in M6.
- **Purified Blooms to start:** a new profile starts with 10; the current profile keeps the ones it has banked (owner).
- **The banner screen:** Pull 1 and Pull 10, the odds table, the pity counter ("SSR guaranteed within N pulls"), the pool, and the recent history with each pull's pity before and after.

**As built in M5.3 (27 Oct; placeholders, my call):**
- An SR gives 1 ascension material of a random Domain; an R gives 1 Faint Memory and 100 Ducats.
- A ten-pull's SR is its tenth pull, upgraded from R only if the nine before were all R. Hard pity counts from the last SSR, per banner family; the screen shows "SSR guaranteed within N pulls".
- The audit keeps every pull in the profile: banner, rarity, what it gave (Pollen included), the character and dupe handling for an SSR, any guarantee, and pity and Blooms before and after. The screen shows the newest 20.
- The gacha stream is seeded from the browser on a profile's first pull and lives in the profile after that.

## Dupes and Pollen

- A duplicate SSR adds a dupe level, C1 to C5: the passive, then stats, a Flavour card, the ultimate, and a capstone (DESIGN.md). C0 is complete; a dupe only deepens what is there. Dupe effects are drafted per character with the kits, for the owner's approval.
- **The starters never enter a banner.** Their dupes will be bought with **Pollen**, a currency every pull gives (a lost 50/50 more), spent in a shop on specific characters' dupes, so they don't pollute the Standard pool (owner).
- **The shop is the Profile Shop, after M5.** In M5, Pollen and dupe overflow past C5 are counted in the profile and shown, then carried into the shop when it arrives (owner). So the starters stay at C0 in M5, and only the banner four need dupe effects now.
- **My call: one currency.** DESIGN.md converts overflow into "profile-shop currency"; I make that Pollen too, so overflow and pulls feed the same thing. Placeholders: 1 Pollen per pull, 40 per overflow dupe.

## Levels, Memories and ascension

- **Levels 1–40, ascending at 10, 20 and 30 (owner, placeholders).** Each level raises HP, Attack and Defense by a small share of base, so cards grow slowly. A level-1 character has today's stats exactly, so the M4 run plays as it does now. More stats, such as critical rate and damage, come later as another way to build (owner).
- **Memories** come in three tiers: Faint (100 EXP), Clear (500) and Vivid (2,000). Levelling spends Memories plus Ducats; spending a big Memory on a cheap level refunds the excess as smaller ones (DESIGN.md).
- **Banking:** Memories and Ducats bank at run end with the Purified Blooms (owner). A win banks an amount per fight won and per elite, plus the Boss; Fruiting doubles it, as it doubles the Blooms. A defeat or abandon banks by the Blooms' rule: an amount per elite beaten, 3 at most, and nothing for a run quit before any progress. The result screen lists them with the Blooms.
- **Ascension** needs that Domain's material plus Ducats.
- **Where materials come from** (owner):
  - **Domain Trials (M6), the main source.** Each Domain has Trials in difficulty tiers; a higher tier pays more. A Trial is a fight straight against a boss, with no map, and a defeat pays nothing. Tier 1 is no real challenge but not impossible for a team at its level.
  - **A won run, on the side:** the Boss victory gives a random material, generally one. It isn't doubled at Fruiting and isn't given on defeat.
  - **SR results**, until weapons arrive.
  - In M5, then, materials come only from SR results and Boss wins, so ascension costs are set low enough for that (my call).
- **Levels make the M4 run easier, and nothing scales it back up** until depth tiers in M6. That is intended progression; the owner will take care not to over-level in testing.
- **Profile level** waits for M6 with depth tiers (owner). **Skill levels** and the **Profile Shop** wait for M6 or later.

## The banner characters

Virelle (Flesh, striker), Isadora (Rapture, spender and scaler), Kibane (Spirit, Ritual nuker) and Hester (Unbound, debuff and control) get full kits like the starters: five cards, a passive, an ultimate and a Transcend, plus two reward cards each and C1–C5 dupes, from the directions in DESIGN.md. They're drafted in their own note (`docs/notes/banner-kits.md`) for the owner's approval, and they get sprites and portraits through `npm run art` for him to pick. Gloomdrawn's Virelle and Kibane art can stand in until then.

## Tasks

1. **M5.1 Roster and party select:** the profile owns characters; choose four before a run; the working names on screen.
2. **M5.2 The banner four:** kits and dupe effects approved, then as content with scenario tests; their art.
3. **M5.3 The gacha:** the Standard banner, rates and pity, SR and R as materials, the audit history, the banner screen, Pollen counted.
4. **M5.4 Dupes:** C1–C5 for the banner four, and overflow into Pollen.
5. **M5.5 Levels, Memories and ascension:** Ducats, Memories, level up with refunds, ascension materials, banking them at run end.
6. **M5.6 Collection (owner playtest):** pull, build up a character, and take a party of your choosing through a run.

## Owner's answers (25 Oct)

1. Any four; pure parties will likely synergise better, but players can mix and match.
2. Yes: SR gives ascension materials, R gives EXP items and money.
3. Standard only for M5. Featured later: a menu to pick the target Featured banner freely.
4. Yes: 10 for a new profile, and the current profile keeps its pulls.
5. Yes, for now. More stats (critical rate and damage) come later.
6. Starters get dupes another way: a "dust" currency from pulls, more from lost 50/50s, buys specific characters' dupes, starters included, in a shop, keeping them out of the Standard banner.
7. Yes: count overflow now, and migrate it when the Profile Shop arrives.
8. Yes.
9. Mainly Domain Trials, in Domain and difficulty tiers (a direct-to-boss fight with no map; defeat gives nothing; tier 1 easy but not impossible for level-appropriate teams). On the side, a random material for a won run, on the Boss victory, not doubled and not on defeat.
10. Profile level in M6; he'll be careful not to over-level in testing.
11. In-universe names: money as Marks or Ducats; small, medium and large Memories; Flesh Sac, Rapture Tendril, Spirit Shard and Unbound Badge; pulls named thematically (such as Purified Blooms), with a dust such as Bloom Pollen or Nectar.
