# M3 Labyrinth: draft for owner review

Status: **draft, 19 Oct**. Covers what M3 needs that DESIGN.md leaves open: the board's size and shape, movement, fog distances, the Bloom clock, Obols and Shops, Camps, Events and Symptoms. Every number is a placeholder for you to mark up. Questions are numbered at the end.

M3 ends with a whole Labyrinth you can walk from the entrance to a Boss tile. The real Boss, card rewards, banking and save/resume are M4. Until then, the Boss tile holds the hardest M2 elite, and beating it wins the run.

## The board

One board per run, stitched from hand-authored motifs:

- **Main route:** about 14–18 steps from the entrance to the Boss, built from 4–5 route motifs laid end to end.
- **Side motifs:** 3–4 hang off the route through sockets:
  - the temptation loop (your diagram, exactly);
  - an elite branch;
  - a Camp nook;
  - an Event cul-de-sac.
- **Tile roles:** a motif marks each slot as a role (fight, elite, event, Camp, Shop, Symptom, Collapsing, path). The run seed fills each role from a pool, so the same motif plays differently.

**Totals for one board, aiming at 6–10 fights in 35–70 minutes:**
- about 60–80 tiles;
- 5–7 normal fights and 2 elites;
- 3–4 Events, 1–2 Shops and 2 Camps;
- 1–2 Symptoms.

**Never stranded.** A validator replays every order in which you could step off Collapsing tiles. From every tile you can reach, a way to the Boss must survive. A board that fails is rerolled from the seed. This runs in tests over many seeds as well as at generation time.

## Moving

- **Click any revealed tile you can reach.** The party walks the shortest route over open tiles. It stops on the first fight, Event or unpaid Symptom, and goes around fights where it can. Shops and Camps along the way don't stop the walk; clicking one goes there.
- **The automatic route never crosses a Collapsing or Symptom tile.** To use one, you click it directly, so you never spend one by accident.
- **Entering a fight tile starts the fight.** There's no retreat. You avoid a fight by walking around it, where the board allows.
- Cleared tiles become path and never respawn (DESIGN).

## Fog of war

DESIGN's rules, with distances:

- The layout of the path is revealed within **2** tiles of anywhere the party has stood.
- A tile's contents are revealed when the party stands **next to** it.
- Landmarks (Shops, Elites, the Boss) are visible from **4** tiles away. The Boss's direction is always shown at the board's edge, so you're never lost.
- Collapsing and Symptom tiles stay marked once revealed.

## The Bloom clock

Fights, Events and using a Camp tick it. Walking, Shops and Symptoms don't (DESIGN; Camp use is the "lean yes").

**Ticks per stage:** 3. That gives 12 ticks to reach Fruiting, a little past a 10-fight run's worth. So a direct run sees Flowering, and a greedy one sees Fruiting.

| Stage | Ticks | Effect (placeholders) |
|---|---|---|
| Dormant | 0–2 | Baseline |
| Seeded | 3–5 | Enemies +10% HP and damage; +10% Obols |
| Rooted | 6–8 | +20%; +20% Obols; rarer Events can appear |
| Flowering | 9–11 | +35%; +35% Obols; normal fights may draw from the elite roster |
| Fruiting | 12+ | +50%; at the start of each fight the party takes 5% of max HP |

The map shows each stage as drawn decoration (buds, shoots, veins, petals, pods). M3 uses simple tile tints and a stage plaque. The drawn overlays, and the enemy overlays per stage, are art for later.

## Obols and Shops

Obols are run-only, earned from first clears. M4 sets the economy, so M3 uses placeholders:

| Source | Obols |
|---|---|
| Start of run | 0 |
| Normal fight | 20 |
| Elite | 45 |
| Event | per its choices |

**A Shop's stock is rolled from the seed when you first reveal it, then fixed all run:**
- 3 relics from the relic pool.
- One service: "Mend" (heal 25% of max HP), 40 Obols, usable once per Shop.

**Prices:**
- Common 50, Uncommon 80, Rare 120, Cursed 30.
- A Rare is meant to be out of reach on the first visit, which is what makes the loop tempting.

There's no selling. Cards come into Shops in M4, with card rewards.

## Camps

One use each. Using a Camp ticks the clock.

- **Rest:** heal 30% of max HP.
- **Treat:** remove one Symptom from the deck.

You can step off and keep the Camp for later (DESIGN).

## Symptoms

A Symptom is a card with a real benefit and a real cost (DESIGN). The tile shows the exact card, and you accept it to pass. It then joins the run's deck, and the tile is free to cross after.

Symptoms belong to the party, not to a character. They don't count toward anyone's five cards, and when played the front member acts.

**Four drafts:**

| Card | Cost | Effect |
|---|---|---|
| **Fevered Pulse** | 0 | Gain 2 Mana. The party loses 4 HP. Exhaust. |
| **Sweet Rot** | 1 | Deal 14 damage. Apply 2 Poison to the party. |
| **Grafted Hand** | 0 | Draw 2 cards. Next turn, draw 1 fewer. |
| **Pollen Lung** | 1 | Gain 1 Ultimate charge for every member (+15). The party gains 1 Weak. |

Art notes come later with card art.

## Events

Each Event is a short scene with 2–3 choices, from a pool. Four drafts, from "Who they are" in DESIGN:

1. **The Abandoned Survey Pack**
   - Take the Obols (30).
   - Take the sealed tin: a random Common relic. The party loses 8 HP.
2. **The Censer Left Burning**
   - Breathe it in: every member gains 20 ultimate charge, and you take a Symptom.
   - Snuff it: nothing happens.
3. **The Kneeling Gardener**
   - Help her up: heal 15 HP.
   - Take her shears: a random Uncommon relic, and the clock ticks once more.
4. **The Seed Vault**
   - Pay 40 Obols for a Rare relic.
   - Leave.

## Engine needs

- Ownerless cards (Symptoms) and the run's own deck.
- "Draw fewer next turn".
- Enemy scaling by clock stage, applied when a fight starts.
- The run state gains a board, a position, fog, a clock, Obols and Shop stock.

The map lives in `src/game/` (pure and seeded). Motifs are content. The map screen is React and SVG first; the painted map in the concept is an art pass for later.

## Questions

1. Board size and shape: about 60–80 tiles, a 14–18 step main route, 3–4 side motifs, 6–10 fights?
2. Movement: click any reachable tile and walk the shortest route, stopping at content; never auto-crossing Collapsing or Symptom tiles?
3. Fog distances: layout at 2, contents when adjacent, landmarks at 4, the Boss's direction always shown?
4. Bloom clock: 3 ticks a stage, with the effects in the table? What should Fruiting's "severe pressure" be?
5. Obols and Shops: the placeholder numbers; relics plus a Mend service in Shops for M3?
6. Camps: Rest 30% or Treat a Symptom; using one ticks the clock?
7. Symptoms: party cards outside the five-card rule; are the four drafts the right kind of benefit and cost?
8. Events: approve, mark up or cut the four drafts? Do you want to write Events yourself?
9. The M3 test: one board, the Boss tile as the hardest M2 elite, a win at the Boss and Run again?
