# M4 First winnable run

Status: **answered by the owner, 24 Oct** (his answers are folded in below; the choices left to me are marked "my call"). M4 is a gate: the owner wins a full run, closes the game and resumes it. This note covers what M4 needs that DESIGN.md leaves open: card rewards, the Boss, banking and save and resume. Numbers are placeholders for tuning.

## Card rewards

- **After a normal fight,** the Victory panel offers 3 cards; take one or skip. Normal fights include Bloom-node fights and the elite-roster fights that Flowering puts on normal tiles, which already pay a normal fight's Obols.
- **Elites give their relic pick only,** no card (owner).
- **The pool** is shaped by the party: each member's own reward cards; the generic card of each Domain that has a member in the party; and Unbound's generic card always, since Unbound slots into any team. A Domain with no member never shows (owner).
- **Generic cards go to a random eligible owner,** rolled from the seed when the offer is made (owner): a Domain's card to one of that Domain's members, Unbound's card to any member. The offer shows the owner and the card's numbers with her stats.
- One offer never repeats a card; a run can hold several copies of one card. A taken card joins the run's deck for the rest of the run, played by its owner.
- **No cards in Shops, and no rarities** in M4 (owner).
- **Card removal is deferred (my call).** The owner offered a once-per-Shop "sell" that removes a card for 45 Obols. DESIGN ties removal to a named service with Curses and says Shops don't sell, and a sell needs a rule for which cards may go (Symptoms stay for the run; would a starter card?). It fits better when Curses arrive.

**Reward cards** (provisionally accepted; watch that they don't erode build identity, which a bigger pool will ease):

| Owner | Card (cost) | Effect |
|---|---|---|
| Maelia | **Nursing Bud** (1) | Gain 2 Embryo. Charge Maelia's ultimate by 10. |
| Maelia | **Pollen Drift** (2) | Apply 12 Poison to all enemies. Consume 2 Embryo: apply 12 more (was 3 and 3; Flesh's Poison ×4, 27 Oct). |
| Agathe | **Hymnal Procession** (2) | Gain 3 Tentacles. |
| Agathe | **Thurible Swing** (1) | Deal 4 + Attack damage. If you have 4 or more Tentacles, trigger a volley. |
| Anthe | **Ash Offering** (1) | Gain 2 Essence. |
| Anthe | **Long Vigil** (6, Ritual) | Deal 10 + 6 × Essence damage to all enemies (was 3 ×; doubled after the M5.2 lab, 27 Oct). |
| Leonora | **Ledger Balance** (1) | Draw 1 card. The next card you play costs 1 less. |
| Leonora | **Writ of Seizure** (2) | Apply 2 Weak and 2 Vulnerable to an enemy. |
| A Flesh member | **Grafting Knife** (1) | Deal 4 + Attack damage. Apply 9 Bleed (was 3; Flesh's Bleed ×3, 27 Oct). |
| A Rapture member | **Chalk Circle** (1) | Gain 1 Tentacle. Gain 4 + Defense Shield. |
| A Spirit member | **Quiet Prayer** (4, Ritual) | Gain 8 + 2 × Essence Shield. |
| Any member | **Pocket Watch** (1) | Draw 2 cards. |

## The Boss

**The Hollow Abbess.** The Bloom cult's abbess, half taken into a root-tree. Resists control (Falter, like the elites). The concept stands (owner).

**HP bars, not a mark (owner).** 400 HP as two bars of 200 (two of 500 since 27 Oct). Under the bar, a red blip for each bar still to come; it goes grey when its bar comes up.
- When a hit empties a bar, the rest of that hit is lost, the next bar comes up full (200/200), and **the Boss is immune to damage for the rest of the party's turn**. The immunity is shown on her, so it's never unexplained.
- Her next intent becomes **Rouse**: she clears her statuses and the next phase begins. My call on timing: the immunity lasts until the Rouse resolves, so Poison or Bleed ticking at the start of her turn can't chip the fresh bar either.
- Later, specific pierce effects or stacking instant-death effects may get past the immunity (owner). Nothing in M4 does.

**Phase 1, Sermon,** cycling:
- Censer Sermon: the party gains 2 Weak.
- Crozier Blow: 26 damage.
- Call the Faithful: summons a Root-Sworn Novice into each side lane (two at most).

**Phase 2, Rooted,** cycling:
- Root Lash: 13 damage, twice.
- Grasping Roots: the party gains 2 Vulnerable.
- Bloom Burst: 44 damage.

**The Bloom doesn't scale bosses (owner).** A raw percentage would force base numbers down and make ordinary runs too easy. Fruiting makes a Boss harder by design instead: a third phase, or a different second phase with its own moveset, possibly with "Bloomed" art ("Matriarch, Fully Bloomed"). Not necessarily for this Boss.

**Draft, my call: the Abbess at Fruiting.** So the idea is built and playable with the first Boss, her second phase at Fruiting is **Full Bloom** instead of Rooted:
- Root Lash: 13 damage, three times.
- Pollen Choir: the party gains 2 Weak and 2 Vulnerable.
- Call the Faithful: as in the Sermon.
- Bloom Burst: 51 damage.

Bloomed art for her is a nice-to-have, after the base sprite.

**As built in M4.2** (`src/engine/phases.ts`, `src/content/enemies/hollow-abbess.ts`; numbers are placeholders):
- Her Rouses are named Taking Root (Rooted) and Blossoming (Full Bloom); each only clears her statuses. Full Bloom is a second enemy definition sharing her Sermon, fought through the Boss encounter's `fruiting` encounter when the fight starts at Fruiting.
- Immunity covers damage and HP loss (Poison and Bleed included); statuses still land, and the Rouse clears them. Tentacle volleys pass a rousing enemy by and hit the others; the hit that breaks a bar loses the rest, so it doesn't carry over to the Novices either.
- A bar can also break at the end of your turn (Tentacles, Poison). Her Rouse then acts at once, so you may not see her Immune on your turn.
- Stun on a rousing enemy that doesn't resist control would lose the Rouse: the new phase starts without clearing statuses. She resists control, so it never happens with her.
- Her plate shows a red blip for each bar still to come (grey once it is up), and an Immune badge while she rouses. On the battlefield the break is a swell and the new phase's name.
- Changing the Boss pool shifted the board's later content draws, so some fight tiles on existing seeds hold different encounters.

**Her Novices.** After his first win (194 of 210 HP left), the owner found her not dangerous and asked for a small damage raise and adds of her own: tougher than the Acolytes, which fell to one Tentacle volley, and in the way, with debuffs or Shield or healing for her. Draft (placeholders): her numbers above are raised about 25%, then again about 20% after his second win (on full HP, thanks to a timely ultimate), and the Root-Sworn Novice (80 HP) cycles Kneeling Prayer (12 Shield to every enemy, the Abbess included), Bitter Incense (the party gains 1 Vulnerable) and Thorn Rosary (8 damage).

**Tuned after the banner-four run (owner, 27 Oct).** He beat her with Virelle, Maelia, Isadora and Agathe, clearing her first bar on turn 3 and her second the turn after, with 173 HP left after the whole run. Each bar is now 500 (1000 in all), and her damage and the Novices' Thorn Rosary are about 10% higher (the numbers above, and Thorn Rosary 9).

**Art:** one new sprite through `npm run art`. Brief: a tall abbess in bruise-violet vestments, lower body split into pale roots gripping the floor, a brass crozier wound with blush petals, a hollow where her face should be framed by ivory lilies. Violet, brass, ivory. The Novices have their own sprite (brief: `art/briefs/root-sworn-novice.txt`).

**Engine needs:** HP bars per phase (a bar break, immunity, a Rouse intent, a phase's own intent cycle, a phase chosen by the Bloom stage at the start of the fight); the bar count on the stage; side lanes for adds around a large anchor.

## Banking

Pulls are the only profile reward until M5's profile systems (provisional).

- **Win:** 5 pulls; 10 if the Boss falls at Fruiting.
- **Defeat or abandon:** 1 pull per elite beaten, 3 at most, and nothing else. A run quit before any progress banks nothing, so starting and quitting a run is never a way to farm pulls (owner).
- Later, the owner may drop the cap and instead bank half a win's rewards, rounded up. Either way, no route (an elite rush) should beat playing to win.
- **The result screen** lists what was banked and why ("Boss at Fruiting: ×2", "2 elites beaten").

**As built in M4.3** (`src/game/profile.ts`):
- Only elite tiles count as elites beaten. An elite's roster that Flowering puts on a normal tile is a normal fight, as it is for Obols.
- Elites add nothing to a win, so a win (5) always banks more than the most a defeat can (3).
- The run count counts every run that ends: won, lost or abandoned, even one that banks nothing.
- The result screen lists each reason ("2 elites beaten: 2 pulls", "4 elites beaten: 3 pulls (3 at most)", "The Boss at Fruiting: ×2"), then "This run: N pulls" and the pulls banked in all. If the profile can't be saved, it says so.
- There's no title screen yet, so the banked total shows only on the result screen until M4.4.

## Save and resume

- **What is saved:** the whole run (board, fog, clock, Obols, Shops, deck, relics, gauges, streams), and during a fight the whole combat state. Closing mid-fight resumes on the same turn with the same hand and intents.
- **Profile save:** banked pulls and a run count, for now.
- **Title screen:** Continue (if a run is saved), New run, and the banked pulls. Starting a new run over a saved one asks first, and counts the old run as abandoned (banking its share).
- **Abandon run:** in a small menu on the map, with a confirm.
- **A save the game can't migrate** ends as an abandon and banks its share, with a line saying why (owner: default to safety, never risk the profile). So a run's banking tally (elites beaten) is kept in the profile as it changes, readable even when the run save isn't.
- **Export and import (my call: in M4).** ARCHITECTURE already plans the save-file button, it guards the owner's saves through M5's schema changes, and migrations are needed either way. One file holds the profile and the run; an import that fails validation changes nothing.

**As built in M4.4** (`src/app/saves.ts`, `src/app/Title.tsx`, `src/save/`):
- The game opens on the title screen: the banked pulls and run count, Continue (only with a run saved), New run, and Export save and Import save. A new run's board is random; `?seed=N` still fixes it in dev builds.
- The run is saved at every step it settles on, after every choice, and after every combat command. A walk is saved at its end as soon as it starts, so closing mid-walk resumes where the party was going. A resumed fight shows as it stands; the last command's animation doesn't replay.
- The map has a Menu (bottom left) with Keep playing, Title screen (the run stays saved) and Abandon run, which shows what it would bank before you confirm. There's no menu during a fight; close the page and Continue instead.
- The profile records the run in progress by ID, with its elite tally. A run save with another ID was already banked and is dropped. A run in progress that can't be resumed ends as abandoned, banks from the tally and says why on the title screen. That covers a save that won't read, names content the game no longer has, or was written with a different content version (`src/content/version.ts`, raised only when a shipped definition changes meaning).
- Importing a file replaces both the profile and the run with the file's; one that fails validation changes nothing and says why.
- Writes go through one queue, in order, and a burst of run saves writes only the newest. A failed write keeps the last good save, and the next save tries again.

## Tasks

1. **M4.1 Card rewards:** the reward cards as content with scenario tests; the pool and owner rolls; the card pick on the Victory panel.
2. **M4.2 The Boss:** HP bars, immunity and Rouse in the engine; the Abbess (both second phases) as content with scenario tests; side lanes and the bar blips on the stage; her sprite.
3. **M4.3 Profile and banking:** the profile save, banking on win, defeat and abandon, the result screen.
4. **M4.4 Save and resume:** run and combat saves, the title screen, Continue, Abandon, export and import. An e2e test closes the page mid-fight and mid-walk and resumes exactly.
5. **M4.5 A full run (owner gate):** the owner wins, quits and resumes a full run. A golden replay of a scripted run through a save and a resume.

## Owner's answers (24 Oct)

1. Elites give relics only, no card.
2. The reward cards are a provisional yes; watch build identity.
3. Unbound's card is always in the pool. Generic cards go to a random valid owner, and the pool never shows a Domain the party lacks.
4. No cards in Shops. A once-per-Shop sell (remove a card, gain 45 Obols) may come now or later.
5. No rarities in M4; removal as above, now or later.
6. The concept stands, at 400 HP, as HP bars (see the Boss).
7. No Bloom scaling for the Boss; Fruiting changes a Boss's phases instead.
8. Defeat or abandon: 1 pull per elite (cap 3 for now), and no pull for starting and quitting a run.
9. Yes: an unreadable save ends as an abandon and banks its share.
10. Export and import now or later, the builder's call.
