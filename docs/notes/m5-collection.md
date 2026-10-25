# M5 Collection

Status: **draft for the owner, 25 Oct.** M5 adds a roster you choose a party from, the gacha, dupes, and levels with the EXP bank and ascension, plus the four banner characters. DESIGN.md sets the gacha's rates and pity and the shape of each system. This note covers what it leaves open. The questions are numbered at the end; numbers are placeholders for tuning.

## The roster and the party

- The profile owns characters. A new profile owns the starter four. Every character you own can be in a party.
- **Before a run, you choose four** owned characters and their order (front first). My call: no Domain rules, so any four will do. The card reward pool already follows the party.
- Screens: a **Roster** (owned characters and their level, ascension and dupes), a **character page** (stats, kit, level up, ascend), the **Banner**, and **party select** before New run. Each is reached from the title screen.

## The gacha

DESIGN.md fixes the rules: SSR 3%, SR 15%, R 82%; hard pity at pull 30; no soft pity; a ten-pull gives at least one SR. Odds, pity, the pool and the history are always on screen, and every pull is audited. Gacha randomness has its own seeded stream in the profile.

- **Standard banner only in M5 (my draft).** Its pool is the four banner characters. A Featured banner needs a rule for when it rotates that has no clock in it, and more characters to feature. Its 50/50 and the two-loss guarantee wait until then (question 3).
- **What do SR and R results give before weapons exist?** DESIGN.md says SR and R results are weapons, and weapons come in M6. My draft: until then, an SR gives ascension materials, and an R gives EXP items and money. DESIGN.md already lists materials as a result family, and none of this goes to waste (question 2).
- **Pulls to start with.** DESIGN.md gives the tutorial "enough for an early multi-pull". There's no tutorial yet, so my draft is that a new profile starts with 10 pulls. Your current profile keeps the pulls it has banked (question 4).
- **The banner screen:** Pull 1 and Pull 10, the odds table, the pity counter ("SSR guaranteed within N pulls"), the pool, and the recent history with each pull's pity before and after.

## Dupes

- A duplicate SSR adds a dupe level, C1 to C5: the passive, then stats, a Flavour card, the ultimate, and a capstone (DESIGN.md). C0 is complete; a dupe only deepens what is there.
- **Can the starters get dupes?** DESIGN.md says the other four enter the Standard banner, which reads as the starters staying out of its pool, but it also calls Standard "all generally released characters". If the starters stay out, only the banner four reach C1+ in M5 and need dupe effects (20 rather than 40) (question 6).
- **Overflow past C5** converts to Profile Shop currency, and the Profile Shop isn't in M5's scope. My draft: overflow is counted in the profile and shown, ready for the shop (question 7).
- Dupe effects are drafted per character with the kits, for your approval.

## Levels, the EXP bank and ascension

- **Levels 1–40 in M5 (my draft),** ascending at 10, 20 and 30. Each level raises HP, Attack and Defense by a share of base (draft: +4% HP, and +1 Attack or Defense every few levels, so cards grow slowly). A level-1 character has today's stats exactly, so the M4 run plays as it does now.
- **EXP items** come in three tiers worth 100, 500 and 2,000 EXP (draft). Levelling spends EXP items plus money; spending a big item on a cheap level refunds the excess as small items (DESIGN.md).
- **Where they come from:** "passively from all play" (DESIGN.md). My draft banks them at run end with the pulls: a fixed amount per fight won and per elite, a bonus for the Boss, and the defeat share by the same rule as pulls. The result screen lists them with the pulls.
- **Ascension** needs Domain materials plus money: one material per Domain, so four kinds. Where they drop is question 9.
- **Levels make the M4 run easier, and nothing scales it back up** until depth tiers in M6. That is intended progression (DESIGN.md), but you'll feel it in M5.
- **Profile level** caps character level (DESIGN.md). My draft leaves it for M6 with depth tiers, since it paces power against depth (question 10).
- **Skill levels** and the **Profile Shop** aren't in M5's scope in DESIGN.md; they wait for M6 or later.

## The banner characters

Virelle (Flesh, striker), Isadora (Rapture, spender and scaler), Kibane (Spirit, Ritual nuker) and Hester (Unbound, debuff and control) get full kits like the starters: five cards, a passive, an ultimate and a Transcend, plus two reward cards each, from the directions in DESIGN.md. I'll draft them in their own note for your approval, as with the starter kits, and they get sprites and portraits through `npm run art` for you to pick. Gloomdrawn's Virelle and Kibane art can stand in until then.

## Tasks (draft)

1. **M5.1 Roster and party select:** the profile owns characters; choose four before a run.
2. **M5.2 The banner four:** kits and dupe effects drafted and approved, then as content with scenario tests; their art.
3. **M5.3 The gacha:** the Standard banner, rates and pity, the audit history, the banner screen; a test of pity and rates over many seeded pulls.
4. **M5.4 Dupes:** C1–C5 for the banner four, and overflow.
5. **M5.5 Levels, EXP and ascension:** money, EXP items, level up with refunds, ascension materials, banking them at run end.
6. **M5.6 Collection (owner playtest):** pull, build up a character, and take a party of your choosing through a run.

## Questions

1. Any rules for party select (a Domain spread, a required starter), or is any four fine?
2. Before weapons exist, should SR and R results be materials (SR: ascension materials; R: EXP items and money)?
3. Is Standard only right for M5? If you want a Featured banner now, how should it rotate without a clock: after a set number of pulls, or when you choose?
4. 10 pulls for a new profile, and your current profile keeps its banked pulls?
5. Levels 1–40 with ascension at 10, 20 and 30, and slow stat growth, as placeholders?
6. Can the starters get dupes in M5? They aren't in the Standard pool. Options: they join the pool, they gain dupes some other way later, or they stay C0 for now.
7. Dupe overflow: count it now and spend it when the Profile Shop arrives?
8. EXP and money banked at run end alongside pulls, with the defeat share by the pull rule?
9. Where do the four Domain materials drop: from elites and the Boss at random, by the party's Domains, or something else? (Trials, which target a material, are M6.)
10. Profile level in M6 with depth tiers, or does it need to cap levels from the start?
11. Working names until the final ones: "money", "small/medium/large EXP" and "Flesh/Rapture/Spirit/Unbound material"?
