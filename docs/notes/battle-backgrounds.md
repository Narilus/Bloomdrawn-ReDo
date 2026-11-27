# Battle backgrounds (M6.11)

The first part of the art pass (owner, 27 Nov). Painted backgrounds replace the backdrop drawn in code (`backdrop()` in `src/stage/Battlefield.ts`), which stays for a band without art yet. The owner's constraint: actors must never look as if they stand on a wall or on the wrong plane.

## The plan (owner, 27 Nov)

| Band | Depths | Biome | Pool |
|---|---|---|---|
| 1 | 1–10 | The cathedral (its Boss is the Hollow Abbess) | the four naves, in the game |
| 2 | 11–20 | The Thicket: an old forest of pale-brown trunks and green leaves that the Bloom is mingling into (`bestiary-direction.md` 4.1) | the four green woods (`bg-thicket-green`), in the game |
| 3 | 21–30 | The Lost Expedition's ruined camp, frozen: snow, ice and bitter cold (4.2) | the four frozen camps (`bg-camp`), in the game |
| 4 | 31–40 | The Calyx, inside the Bloom (4.3) | the four petal chambers (`bg-calyx`), in the game |
| 5 | 41–50 | The source: the crater where the Bloom took root, black basalt, grey ash and bone roots around a red heart, for contrast | the four craters (`bg-source`), in the game |

- Normal fights and elites draw from their band's pool, about four scenes each, picked by the fight's seed so a resumed fight keeps its scene (`src/stage/scenes.ts`). The band is the run's depth (a Trial's level), not the enemies' own band.
- The 6 run Bosses and 4 Trial Bosses get richer or wholly custom scenes, named after their encounter: one (`hollow-abbess.webp`) or a pool of their own picked by seed (`hollow-abbess-1.webp`, `-2`…). Until one exists, a Boss stands in its band's pool. Its Full Bloom bar stays in the same scene.
- **The Hollow Abbess** (owner, 27 Nov): the cathedral's candlelit sanctuary, checkered marble before an altar of candles, amber glass and a rose window, her root-tree broken through the wall; all four options, picked by seed (`bg-hollow-abbess`).
- **The Gathered Beast** (owner, 27 Nov): its lair at the heart of the green wood, a trampled clearing under colossal trees hung with antlers, skulls and ribs, lit by a shaft of gold daylight; all four options, picked by seed (`bg-gathered-beast`).
- Later: a more-bloomed version of each pool scene, made from the original so its layout holds, as a tell of the Bloom clock's stage.

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

## How a background is made and checked

`npm run art -- gen bg-<scene> --stem scene --n 4` makes wide options. `npm run art -- stage art/cut/bg-<scene>-stage.png art/raw/bg-<scene>/*.png [--boss <name>]` crops each option to 16:9 and puts the real sprites on it at their feet positions, with the game's shadows and draw order: the starters against three enemies (a large anchor and two flanks), and against a Boss alone (the Hollow Abbess, or the scene's own Boss with `--boss`). The owner picks from that sheet, so a floor line in the wrong place is seen with the actors on it, not guessed at. `npm run art -- pick <raw.png> --scene band<N>-<n>` (or a Boss's name, alone or with `-<n>`) frames the pick to 1920×1080 as WebP in `src/assets/scenes/`, about 270 KB each, and the game finds it by name.

## Open

- **Style:** painted, per DESIGN.md's prompt stem, behind pixel-art sprites. The owner found all four naves good; whether the mix holds in play is his call.
- **Spare scenes:** the all-pink wood of flesh trunks (`art/raw/bg-thicket/`) lost Band 2 to the greener set but is kept for a future biome (owner, 27 Nov).
- **Contrast** (owner, 27 Nov): Bands 1–4 lean on purple and pink with little contrast. That has its uses, and more biomes will dilute it, but Band 5's brief should allow more contrast. Band 5 does that with value rather than hue: grey ash, black stone, a pale sky and red only from the heart (owner, 27 Nov).
- **The wall line** came in at about half way rather than 40%, so the back slot stands near the foot of the wall. It reads as floor; briefs keep asking for 40%.
