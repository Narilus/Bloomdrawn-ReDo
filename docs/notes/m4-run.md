# M4 First winnable run: draft for owner review

Status: **draft, 23 Oct**. M4 is a gate: you win a full run, close the game and resume it. This note covers what M4 needs that DESIGN.md leaves open: card rewards, the Boss, banking and save and resume. Every number is a placeholder for you to mark up. Questions are numbered at the end.

## Card rewards

DESIGN gives normal fights "modest Obols and a card reward", offered from pools for the party's Domains and characters. Cards gained in a run join the run's deck (beside the Symptoms) for the rest of the run.

**Proposal:**
- **After a normal fight,** the Victory panel offers 3 cards; take one or skip.
- **After an elite,** the panel offers the relic pick as now, and then 3 cards (Q1).
- **The pool** is each party member's reward cards plus the generic card of each Domain in the party. One offer never repeats a card; a run can hold several copies of one card.
- **Generic Domain cards** must be assigned to an eligible owner: a party member of that Domain. The preview shows the card's numbers with that owner's stats. With the starter four there is one member per Domain, so only Unbound's card needs a real choice, if any member may take it (Q3).
- **Shops** also sell 2 cards, rolled with the rest of the stock, at 45 Obols each (Q4).
- No card rarities and no card removal in M4 (Q5).

**Draft reward cards** (built from operations that exist; names and numbers are placeholders):

| Owner | Card (cost) | Effect |
|---|---|---|
| Maelia | **Nursing Bud** (1) | Gain 2 Embryo. Charge Maelia's ultimate by 10. |
| Maelia | **Pollen Drift** (2) | Apply 3 Poison to all enemies. Consume 2 Embryo: apply 3 more. |
| Agathe | **Hymnal Procession** (2) | Gain 3 Tentacles. |
| Agathe | **Thurible Swing** (1) | Deal 4 + Attack damage. If you have 4 or more Tentacles, trigger a volley. |
| Anthe | **Ash Offering** (1) | Gain 2 Essence. |
| Anthe | **Long Vigil** (6, Ritual) | Deal 10 + 3 × Essence damage to all enemies. |
| Leonora | **Ledger Balance** (1) | Draw 1 card. The next card you play costs 1 less. |
| Leonora | **Writ of Seizure** (2) | Apply 2 Weak and 2 Vulnerable to an enemy. |
| Flesh (any) | **Grafting Knife** (1) | Deal 4 + Attack damage. Apply 3 Bleed. |
| Rapture (any) | **Chalk Circle** (1) | Gain 1 Tentacle. Gain 4 + Defense Shield. |
| Spirit (any) | **Quiet Prayer** (4, Ritual) | Gain 8 + 2 × Essence Shield. |
| Unbound (any) | **Pocket Watch** (1) | Draw 2 cards. |

## The Boss

DESIGN: phases with telegraphed transitions, control resistance, a large anchor with adds in side lanes, and no hidden instant kills or unexplained immunity. The Boss tile holds the hardest elite until now.

**Draft: the Hollow Abbess.** The Bloom cult's abbess, half taken into a root-tree. Resists control (Falter, like the elites). HP 300 (Q6).

- **Phase 1, Sermon** (full HP down to half), cycling:
  - Censer Sermon: the party gains 2 Weak.
  - Crozier Blow: 16 damage.
  - Call the Faithful: summons a Censer Acolyte into a side lane (two at most).
- **Transition.** Her HP bar carries a mark at half. When a hit takes her past it, the hit lands in full, and her next intent becomes **Taking Root** (gain 30 Shield), shown at once, so you see the change a turn ahead.
- **Phase 2, Rooted**, cycling:
  - Root Lash: 8 damage, twice.
  - Grasping Roots: the party gains 2 Vulnerable.
  - Bloom Burst: 28 damage.
- **Scaling:** the Boss scales with the Bloom stage like any fight, so winning at Fruiting is the hardest fight and doubles the rewards (Q7).
- **Art:** one new sprite through `npm run art`. Brief: a tall abbess in bruise-violet vestments, lower body split into pale roots gripping the floor, a brass crozier wound with blush petals, a hollow where her face should be framed by ivory lilies. Violet, brass, ivory. The Acolytes reuse their sprite.

**Engine needs:** phases (an HP threshold that swaps the intent cycle and inserts a transition intent); a phase mark on the HP bar; side lanes for adds around a large anchor.

## Banking

DESIGN: a victory banks every profile reward marked during the run; a defeat or abandon banks a reduced, non-zero share scaled by depth and progress. Never banked: Obols, run cards, relics, Symptoms, run HP.

The profile systems (levels, EXP, materials, gacha) are M5. So in M4 the only profile reward is **pulls**, counted in a profile save and shown on the title screen, with nothing to spend them on until M5.

**Proposal:**
- **Win:** 5 pulls; 10 if the Boss falls at Fruiting (owner, 20 Oct, provisional).
- **Defeat or abandon:** 1 pull, plus 1 per elite beaten (3 at most). Depth scaling waits for depth tiers (Q8).
- **The result screen** lists what was banked and why ("Boss at Fruiting: ×2").

## Save and resume

ARCHITECTURE: the active run is saved at map steps and node results, and after each resolved combat command; each save carries schema and content versions; a failed write never replaces the last good save. The save store and IndexedDB adapter exist since M0.

**Proposal:**
- **What is saved:** the whole run (board, fog, clock, Obols, Shops, deck, relics, gauges, streams), and during a fight the whole combat state. Closing mid-fight resumes on the same turn with the same hand and intents.
- **Profile save:** banked pulls and a run count, for now.
- **Title screen:** Continue (if a run is saved), New run, and the banked pulls. Starting a new run over a saved one asks first, and counts the old run as abandoned (banking its share).
- **Abandon run:** in a small menu on the map, with a confirm.
- **An old save the game can't read** (a content change it can't migrate) ends as an abandon and banks its share, with a line saying why (Q9).
- **Export and import** of the save file as a button on the title screen (Q10).

## Tasks, as I'd split them

1. **M4.1 Card rewards:** reward cards as content with scenario tests; the card pick on the Victory panel; assigning a generic card; cards in Shops.
2. **M4.2 The Boss:** phases and transitions in the engine, the Abbess as content with a scenario test, side lanes, her sprite.
3. **M4.3 Profile and banking:** the profile save, banking on win, defeat and abandon, the result screen.
4. **M4.4 Save and resume:** run and combat saves, the title screen, Continue, Abandon, export and import. An e2e test closes the page mid-fight and mid-walk and resumes exactly.
5. **M4.5 A full run (owner gate):** you win, quit and resume a full run. A golden replay of a scripted run through a save and a resume.

## Questions

1. Should elites give a card pick as well as the relic pick?
2. Are the draft reward cards the right kind of thing? Mark up names, numbers and any you'd swap.
3. Can any party member take Unbound's generic card, since Unbound slots into any team? Or only Unbound members?
4. Cards in Shops: 2 at 45 Obols, rolled with the stock on first entry?
5. No card rarities and no card removal in M4: fine, or do you want a removal service now?
6. The Hollow Abbess: is the concept and its two phases right? HP 300 and the intent numbers as placeholders?
7. The Boss scales with the Bloom stage (up to +50% at Fruiting), keeping Fruiting's doubled rewards a real risk?
8. Defeat or abandon banks 1 pull plus 1 per elite beaten, at most 3?
9. A save the game can't migrate ends as an abandon and banks its share?
10. Save export and import in M4, or later?
