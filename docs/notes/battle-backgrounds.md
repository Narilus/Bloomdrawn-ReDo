# Battle backgrounds (M6.11)

The first part of the art pass (owner, 27 Nov). The battlefield today draws a placeholder backdrop in code (`backdrop()` in `src/stage/Battlefield.ts`). Painted backgrounds replace it. The owner's constraint: actors must never look as if they stand on a wall or on the wrong plane.

## Where the actors stand

All in the 1920×1080 frame (`src/stage/layout.ts`). The y values are feet; sprites rise above them.

| | Feet (x, y) | Height | Top of sprite |
|---|---|---|---|
| Party, front to back | (330, 770), (535, 700), (740, 632), (935, 568) | 400 × 1, 0.92, 0.85, 0.78 | y 370 to 256 |
| Enemies, by layout | x 1150 to 1790, y 590 to 700 | 190 small to 480 huge | as high as y 210 (a Boss) |

So the floor every actor stands on has to run from about y 540 down, across x 180 to 1920. The highest feet are at y 568, the party's back slot.

## The composition every background follows

- **One level floor** fills the lower 60%, edge to edge, with nothing standing on it: no steps, stairs, ledges, pillars, plinths, pews, rubble or changes in level where an actor could appear to stand.
- **The far wall meets the floor in one straight horizontal line about 40% down** (y ≈ 430), across the full width. That is about 140px above the highest feet, so everyone reads as standing on the floor in front of the wall.
- **Nothing in front of that line.** Columns and arches are carved into the far wall itself. Things hanging from the top stay in the top 15%, above every head.
- **Calm middle:** ornament at the top and along the wall; the bottom fifth is dark (the hand sits there), and the top corners fall into vignette (the portraits sit top left).
- **View:** standing eye height, looking straight ahead and a little down, square on to the wall. The party's diagonal (the back slot higher and smaller) reads as depth on that floor.

The briefs (`art/briefs/bg-*.txt`) say all this in words, after the DESIGN.md prompt stem.

## How a background is checked

`npm run art -- gen bg-<scene> --stem scene --n 4` makes wide options. `npm run art -- stage art/cut/bg-<scene>-stage.png art/raw/bg-<scene>/*.png` crops each option to 16:9 and puts the real sprites on it at their feet positions, with the game's shadows and draw order: the starters against three enemies (a large anchor and two flanks), and against a Boss alone. The owner picks from that sheet, so a floor line in the wrong place is seen with the actors on it, not guessed at.

## Open

- **Style:** DESIGN.md's prompt stem is painterly, and the sprites are pixel art. The pilot follows DESIGN.md (painterly). If the mix looks wrong, a pixel-art background stem is the owner's call.
- **How many scenes, and where each is used:** for example one per Domain for the Trials, a set for the Labyrinth's depth tiers, and the Bosses' own. The pilot is one scene, a cathedral nave, to settle the composition first.
- **Wiring:** the picked image goes in `src/assets/` and replaces `backdrop()`. That waits for the first pick.
