# M6 Depth and polish

Status: **answered by the owner, 31 Oct** (his answers are in his `docs/notes/m6-direction.md` and folded in below; my readings of what they leave open are marked "my reading" and his to overturn). M6 is depth tiers, more enemies, Trials, profile level, weapons, the Profile Shop, a menu and options pass, an inventory, audio, an art pass and balance. Numbers marked "model" come from a lab model the owner sees before they're final.

## Main menu, Options and inventory

- **The menu:** Expedition (the player-facing name for a run), Trials, Roster, Banners (a sub-menu: the character banner, then the weapon banner), Inventory, Options, Exit. It gets a professional layout pass.
- **Top right:** Ducats and Purified Blooms, each as an icon and a number, the name in a tooltip.
- **Top left:** the profile level badge. It opens the profile page.
- **Options:** settings (volume and mute, accessibility) and Profile management: export, import, and Reset. Reset wipes the profile and any run. It needs a ticked confirmation box, "RESET" typed, then Confirm.
- **Inventory:** every item the profile holds, in sub-menus by item tag (such as resources and weapons).
- My reading: with a run saved, Expedition opens Continue or a new expedition (which abandons the saved one, as now). A browser can't close its own tab, so Exit closes the window where it can and otherwise says the tab can be closed; the desktop wrapper will quit properly.

## Depth tiers

- **About 50 depths. A depth's enemies are at that level:** Depth 36 fields level 36 enemies. Enemies scale by their level and show a small level tag. Characters reach 40; Depths 41–50 are the challenge above that.
- **Scaling is modelled:** the expected party HP and damage output at each level, and enemy HP and damage from level 1 to 50 set against it. Level 1 enemies are today's, so the M4 run and its golden replay stay as they are.
- **Rewards are modelled:** what levelling a character to 40 costs in Memories and Ducats, and a per-depth multiplier, so a player who raises the depth as the party levels needs a bounded number of runs. Depth 40 shouldn't need dozens of runs to level one character.
- **Unlocking:** a new profile's first run is at Depth 1. After it, Depths 1–10 are open. Winning Depth 10 opens 11–20, winning 20 opens 21–30, and so on.
- **No power-band wording.** Players compare the enemies' levels with their own.
- **Monster variety:** a much larger pool of normal enemies, elites and bosses, more of it opening deeper. They're drafted in `docs/notes/bestiary.md` for the owner's approval, with new art.

## The depth model (31 Oct, `npm run lab:depth`)

**Decided (owner, 31 Oct):** stats are the multiplier (`docs/notes/m6-scaling.md`), replacing options A and B. Card numbers are ratios of stats, stats grow ×5 to ×9 by role, and crit joins the party's stats. The first model, before that change, found a level 40 party dealt only 13% more than level 1.

**Retuned (owner, 31 Oct: "completely retune all level 1 stats so you can reach expected targets"; every initial stat is a placeholder).**
- **Characters:** level-1 Attack and Defense are tripled. Damage then outweighs HP enough that elite and Boss pools grow toward the owner's anchors, and Shield keeps pace with harder-hitting enemies. HP is unchanged, since party HP at 40 already meets its anchor. C2 gives +3 Attack and +3 Defense, keeping its share. Card ratios are unchanged.
- **Enemies:** level-1 HP, Shield, heals and damage are retuned per enemy. The Average build plays the real encounters at Depth 1 against the targets, and single hits are capped near half the party's HP. The training dummy goes from 60 HP to 600, since it is only a lab and test target.
- **The curve, in the engine:** HP is 1 + 0.13 × (level − 1) + 0.86 × ascensions due; damage is 1 + 0.1144 × (level − 1) + 0.639 × ascensions due. The steps land at 10, 20 and 30. Past 40, HP rises 9.6% of level 40's a level. Damage rises 4.8%: half HP's rate, a placeholder, since the fit gives almost nothing (a C2 Strong build has barely more HP).

Real encounters, the Average build at the depth's level (`npm run lab:depth`):

| Encounter | Tier | Depth 1 turns | Depth 20 turns | Depth 40 turns | Worst turn (share of party HP) |
|---|---|---:|---:|---:|---:|
| Hound | normal | 2.7 | 2.9 | 2.9 | 13–14% |
| Pods and Lantern | normal | 2.1 | 2.3 | 2.3 | 3% |
| Roots and Smoke | normal | 2.6 | 2.8 | 2.9 | 15–18% |
| Two Hounds | normal | 2.9 | 3.0 | 3.0 | 23–24% |
| Hound Mother | elite | 5.5 | 5.8 | 5.8 | 35% |
| Thorn-Wall Matron | elite | 5.7 | 6.0 | 5.9 | 42–44% |
| The Hollow Abbess | boss | 10.8 | 11.2 | 11.0 | 46–48% |

| Depth | Party HP (Avg / Strong) | Damage a turn, 6 turns (Avg / Strong) | Normal fight HP | Elite HP | Boss HP | Threat a turn: normal / elite / Boss (biggest hit) |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 205 / 214 | 336 / 613 | 128 | 725 | 2,050 | 18% / 14% / 18% (50%) |
| 10 | 547 / 569 | 979 / 1,875 | 386 | 2,184 | 6,175 | same |
| 20 | 912 / 948 | 1,717 / 3,301 | 659 | 3,734 | 10,559 | same |
| 30 | 1,277 / 1,327 | 2,445 / 4,714 | 933 | 5,285 | 14,943 | same |
| 40 | 1,513 / 1,571 | 2,910 / 5,613 | 1,095 | 6,203 | 17,538 | same |
| 50 | 1,513 / 1,571 | 2,910 / 5,613 | 2,112 | 11,965 | 33,832 | 19% / 14% / 19% (52%) |

**Against the targets and anchors:**
- **Turns are on target at every depth** in the real fights: normal 2–3, elite 5.5–6, Boss about 11.
- **Threat:** normal fights deal 18% a turn while unkilled (target 15–25%). The Boss deals 18% a turn, and her biggest hit is 50% (target 40–60% on big hits). Elites read 14%, because the count leaves out summons and Bleed. The Hound Mother with both whelps out deals about 31%. The Matron averages about 20% over her Wall turns but hits for 31% and 49%.
- **Anchors:** party HP at 40 is about 1,500 ("well over 1,000"), and damage a turn is about 2,900 (Average) and 5,600 (Strong). Elites at 40 are about 4,500–8,000 HP and the Boss about 17,500. At 50 they are about 12,000 and 34,000. Elites reach the 10,000–20,000 anchor only past 40, and the Boss stays well short of 100,000. Raising both further means longer fights than the turn targets allow, unless party damage rises again (the ×10 rebase, or weapons).

**Rewards:** a won run of 6 fights, 2 elites and the Boss pays 3,600 EXP and 1,100 Ducats at Depth 1. Levelling one character from 1 to 40 is 78,000 EXP, which is 22 such runs at Depth 1. With a multiplier of 1 + 0.25 × (depth − 1) (×3.25 at Depth 10, ×10.75 at 40, ×13.25 at 50), about one won run levels one character through a band of ten at that band's depths. That is about 3.5 runs from 1 to 40 while raising the depth. Ducats run about 1.2–1.4 runs a band in the middle bands, because the ascension costs come on top.

## Trials

- **One new boss per Domain**, heavily thematic, which really looks like a boss. All new art.
- **Five tiers:** bosses at level 10, 20, 30, 40 and 50. Each tier pays enough of its Domain's material to ascend a character at that level; Tier 5 pays enough for two. My reading: Tier 1 pays 1, Tier 2 pays 2, Tier 3 pays 3, Tier 4 pays 3 (there is no ascension at 40, so it pays the largest), and Tier 5 pays 6.
- **First clears:** 1 Purified Bloom for each of Tiers 1–4, and 3 for Tier 5.
- Winning a tier opens the next. Attempts are unlimited. A defeat pays nothing (DESIGN.md).

## Profile level

- **Earned by play, never by Memories,** like a completion status: fights, elites, bosses, Trials, first Trial clears, and SSR pulls (characters and weapons). A level-up has no pop-up; the badge shows it.
- **Caps at 50.** Ascension needs profile level 5 (the ascension at 10), 10 (at 20) and 15 (at 30).
- **The EXP curve:** the first 5 levels come fast, 10 somewhat slower, 15 takes more work but no unfriendly amount, and 50 takes real time (exponential). The model proposes it.
- **Each level gives 1 Purified Bloom,** claimed on the **profile page**. The page also shows stats: wins and losses, and enemies defeated (normal, elite, Boss, Trial).
- **Levels 25 and 50 give an SSR selector:** an item that gives a chosen SSR, outside pity. My reading: a character from the banner pool, taken like a pulled copy (a dupe if owned).
- My reading: ascensions made before profile level existed stay made. Profile stats count from M6 on.

## Weapons

- **A weapon gives stats** (Attack, Defense or HP) **and one passive line,** like a small relic that belongs to its character. **Signature SSR weapons** boost their owner's kit. **SR and R weapons** are generic, one set per Domain. Each is drafted in `docs/notes/weapons.md` for approval.
- **Pull results:** SR and R results become weapons of that rarity. An R is as likely to be today's Memories and Ducats as an R weapon. My reading: an SR is always an SR weapon, since Trials now supply materials.
- **The weapon banner** has the same rates and rules (Focus, 50/50, pity at 30, a ten-pull's SR) with its own pity, separate from the character banner's.
- Levelling, ascending and refining (+0 to +5, from copies) are DESIGN.md's; the weapons note proposes their numbers.

## Profile Shop

- Character dupes for 100 Pollen each, the starters' included. Other wares come later.

## Audio and art

- CC0 sound effects for cards, hits and the UI first, and music later. Options has volume controls and mute.
- The art pass covers portraits, card art, battle backgrounds, map tiles, the title screen and the banner screens, in any order.

## Tasks

1. **M6.1 Main menu and Options:** the menu, currency counter, Banners sub-menu, Options with profile management and Reset, Exit.
2. **M6.2 Inventory:** item tags and the tabbed inventory.
3. **M6.3 Enemy levels and the model:** enemies scale by level and show it; the lab models party and enemy curves, and the reward multiplier.
4. **M6.4 Depth tiers:** choose a depth, unlocking, scaled rewards.
5. **M6.5 The bestiary:** new enemies, elites and bosses by depth, with art.
6. **M6.6 Profile level and the profile page:** profile EXP and stats, Bloom claims, ascension gates, the SSR selector, the badge.
7. **M6.7 Trials:** four Domain bosses with art, five tiers, rewards and first clears.
8. **M6.8 Weapons:** the weapons note, then weapons, equipping, refining and the weapon banner.
9. **M6.9 Profile Shop:** dupes for Pollen.
10. **M6.10 Accessibility and audio:** settings in Options; sound effects with volume and mute.
11. **M6.11 Art pass.**
12. **M6.12 Balance.**
13. **M6.13 The owner's playtest.**
