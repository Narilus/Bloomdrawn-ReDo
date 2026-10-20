# M3 Labyrinth

Status: **answered by the owner, 19 Oct** (his answers and his M3.3 feedback are folded in below). This note covers what M3 needs that DESIGN.md leaves open: the board's size and shape, movement, fog distances, the Bloom clock, Obols and Shops, Camps, Events and Symptoms. The numbers are placeholders for tuning.

M3 ends with a whole Labyrinth you can walk from the entrance to a Boss tile. The real Boss, card rewards, banking and save/resume are M4. Until then, the Boss tile holds the hardest M2 elite, and beating it wins the run.

## The board

One board per run, stitched from hand-authored motifs:

- **Main route:** about 14–18 steps from the entrance to the Boss, built from 4–5 route motifs laid end to end.
- **Side motifs:** 3–4 hang off the route through sockets:
  - the temptation loop (the owner's diagram);
  - an elite branch;
  - a Camp nook;
  - an Event cul-de-sac.
- **Tile roles:** a motif marks each slot as a role (fight, elite, event, Camp, Shop, Symptom, Collapsing, path). The run seed fills each role from a pool.

**Totals for one board**, the baseline to test (owner):
- about 60–80 tiles;
- 5–7 normal fights and 2 elites;
- 3–4 Events, 1–2 Shops and 2 Camps;
- 1–2 Symptoms.

**Never stranded.** A validator replays every order in which you could step off Collapsing tiles. From every tile you can reach, a way to the Boss must survive. A board that fails is rerolled from the seed. Tests run it over many seeds.

## Moving

- **Click any revealed tile you can reach.** The party walks the shortest route over open tiles, and stops on the first tile that holds a choice or a fight: fights, Events, Shops, unused Camps and unpaid Symptoms (owner). The route goes around such tiles where it can.
- **The route is shown before you commit.** Hovering a tile highlights the route. The party token then walks it tile by tile, not in one jump (owner).
- **The automatic route never crosses a Collapsing or unpaid Symptom tile.** To use one, you click it directly.
- **Entering a fight tile starts the fight.** There's no retreat.
- Cleared tiles become path and never respawn (DESIGN).

## Fog of war

- Layout is revealed within **3** tiles of anywhere the party has stood, contents within **2** (owner). The outer ring shows as unknown tiles, so you can tell whether a tile leads on or ends.
- Routes cross only tiles whose contents are known. An unknown tile can be clicked as a destination, but the route never runs through one, so it can't give away what's there or walk into a fight unseen.
- The view stays centred on the party's tile and follows it as it walks, so the board's shape doesn't hint where the Boss is (owner).
- Landmarks (Shops, Elites, the Boss) are visible from **4** tiles away.
- Everything discovered stays visible (owner). Collapsing and Symptom tiles are marked as soon as they're revealed.
- **Boss direction:** from Flowering on, a marker at the board's edge points toward the Boss. The Bloom shows the way out as it closes in (owner's idea).

## The Bloom clock

Fights, Events and using a Camp tick it. Walking, Shops and Symptoms don't.

| Stage | Ticks | Effect (placeholders) |
|---|---|---|
| Dormant | 0–2 | Baseline |
| Seeded | 3–5 | Enemies +10% HP and damage; +10% Obols |
| Rooted | 6–8 | +20%; +20% Obols; rarer Events can appear |
| Flowering | 9–11 | +35%; +35% Obols; normal fights may draw from the elite roster; Boss direction shown |
| Fruiting | 12+ | +50%; Bloom nodes (below, M3.6) |

There is no HP loss at the start of fights: it can brick a run, and later builds may want full HP (owner). The +50% against the Boss is a balance question for later.

As built in M3.4 (`src/game/bloom.ts`; numbers are placeholders):
- A fight takes the stage it starts at; the tick from winning it comes after. The Boss is scaled like any fight for now.
- Enemy scale raises max HP (summons included) and the damage enemies deal, rounding down, through the same pipeline previews use.
- On reaching Flowering, each normal fight you haven't seen yet has a 1 in 3 chance to draw from the elite roster instead. It stays a normal fight tile; fights you've already seen keep their enemies.
- Obol bonuses come with Obols (M3.5), rarer Events with Events and the Camp tick with Camps (M3.6).

**Fruiting's pressure: Bloom nodes** (owner, 20 Oct). M3.4 built pods (2 fights swelling near the party every tick); in play they made single-lane paths a slog, so they are gone. Bloom nodes replace them in M3.6, since one choice is a Symptom card:
- From Fruiting on, Bloom nodes appear on path tiles near the party, ideally ahead, roughly one per 6–10 tiles walked (placeholder). They are marked like Symptoms.
- Landing on one forces a choice, and the node is used up: a fight from the normal pool; a 50/50 gamble to lose or heal 10% of current HP; or take a Symptom card. A player meets several, so the gamble compounds.
- Choosing doesn't tick the clock: Fruiting is the last stage.
- Winning the run at Fruiting doubles its meta rewards, once those exist (owner, provisional: 5 pulls, 10 at Fruiting).

## Obols and Shops

After a won fight, a Victory panel lists what it gave (Obols, and an elite's relic pick) before the map returns. The map shows the Obols held next to the relics (owner).

| Source | Obols |
|---|---|
| Start of run | 0 |
| Normal fight | 20 |
| Elite | 45 |
| Event | per its choices |

Obols from kit passives, gear and relics can come later as a team-building direction (owner).

**A Shop's stock is rolled from the seed when you first reveal it, then fixed all run:**
- **Four relics, always one of each tier:** Common, Uncommon, Rare and Cursed (owner).
- **One service:** "Mend" (heal 25% of max HP), 40 Obols, usable once per Shop.

**Prices:**
- Common 50, Uncommon 80, Rare 120, Cursed 30.
- A Rare is meant to be out of reach on the first visit.

There's no selling. Cards come into Shops in M4.

As built in M3.5 (`src/game/expedition.ts`; numbers are placeholders):
- Every won fight except the Boss opens the Victory panel: its Obols, and an elite's relic pick. The Obol bonus is the stage the fight started at, rounded down; Fruiting's is taken as +50%, following the other stages.
- A Shop's stock is rolled when you first enter it, which is when you first see it. Re-entering never rerolls.
- It never stocks a relic you own or one already on sale in another Shop. With only seven M2 relics, a tier with none left stays empty. A relic on sale that you then get from an elite shows as Owned.
- Mend can't be bought at full HP, and heals only up to full.
- The Obol counter sits under the party's HP on the map.

## Camps

- **Rest:** heal 30% of max HP. It's the only option (owner).
- Using a Camp ticks the clock.
- You can step off and keep the Camp for later.

## Symptoms

A Symptom is a card with a real benefit and a real cost. The tile shows the exact card, and you accept it to pass. It joins the run's deck and **stays for the run**: there is no treatment (owner).

Symptoms belong to the party, not to a character. They don't count toward anyone's five cards, and when played the front member acts.

**Costs scale.** A flat HP cost means nothing to a levelled team with 1000+ HP (owner). So HP costs are a share of **current** HP, and the card's text shows the live number, worked out by the engine like any card number ("Lose 8 HP (4% of current)").

Other kinds of cost (Mana debt, Weak, fewer draws) scale on their own, because they don't depend on HP at all.

| Card | Cost | Effect |
|---|---|---|
| **Fevered Pulse** | 0 | Gain 2 Mana. The party loses 4% of its current HP. Exhaust. |
| **Sweet Rot** | 1 | Deal 14 damage. Every enemy and the party gain Poison equal to 1% of the party's max HP. |
| **Grafted Hand** | 0 | Draw 2 cards. Next turn, draw 1 fewer. |
| **Pollen Lung** | 1 | Every member gains 15 ultimate charge. The party gains 1 Weak. |

## Events

Each Event is a short scene with 2–3 choices, from a pool. HP costs are a share of current HP: small, but not nothing (owner).

1. **The Abandoned Survey Pack**
   - Take the Obols (30).
   - Take the sealed tin: a random Common relic. The party loses 10% of its current HP.
2. **The Censer Left Burning**
   - Breathe it in: every member gains 20 ultimate charge, and you take a Symptom.
   - Snuff it: nothing happens.
3. **The Kneeling Gardener**
   - Help her up: heal 15% of max HP.
   - Take her shears: a random Uncommon relic, and the clock ticks once more.
4. **The Seed Vault**
   - Pay 40 Obols for a Rare relic.
   - Leave.

## Engine needs

- Ownerless cards (Symptoms) and the run's own deck.
- HP-share amounts in formulas.
- "Draw fewer next turn".
- Poison on the whole field.
- Enemy scaling by clock stage, applied when a fight starts.
- The run state gains a board, a position, fog, a clock, Obols and Shop stock.

The map lives in `src/game/` (pure and seeded). Motifs are content. The map screen is React and SVG first; the painted map in the concept is an art pass for later.

## Owner's answers (19 Oct)

1. The board size is a baseline to test.
2. Stop automatically on any choice tile; show the route and walk it step by step, not teleporting.
3. Layout and contents at 2; everything discovered stays visible; a Boss direction helper at a clock stage, perhaps Flowering.
4. The clock as drafted, without Fruiting's HP loss; Fruiting's pressure is open (pods, or remaining fights turning elite).
5. The Obol numbers are about right; a Shop always offers one Common, one Uncommon, one Rare and one Cursed relic. Obol generation may become a team-building direction later.
6. Camps offer Rest only; Symptoms stay for the run.
7. Symptom costs must scale: a share of current HP, with the live number in the text. Sweet Rot poisons the whole field by 1% of max HP.
8. HP costs in Events are a share of current HP.
9. The M3 test as suggested.

**After looking at the map (M3.3):** layout fog at 3 and contents at 2; the view centred on the party; Fruiting's pressure is pods (replaced by Bloom nodes after M3.4). A Victory panel listing a won fight's rewards, and an Obol counter, come with Obols in M3.5.
