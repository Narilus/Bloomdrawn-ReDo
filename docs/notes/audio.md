# Audio (M6.10)

CC0 sound effects for cards, hits and the UI, with volume and mute in Options (`docs/notes/m6-depth.md`, "Audio and art"). Music comes later. Accessibility left the plan (owner, 16 Nov).

## How it works

- `src/app/sound.ts` turns engine events into cues. The battlefield's `play` says when each event's move starts and when it lands. A card, an ultimate and an enemy's action sound as the lunge starts, and everything else as it lands. A cue sounds once at each moment, so a hit on three enemies is one sound, while each Tentacle hit in a volley gets its own.
- A cue's sound is a file in `src/assets/sound/` named after it: `hit.ogg`, or `hit-1.ogg`, `hit-2.ogg`… to take turns. A cue with no file is silent, so sounds can arrive one at a time.
- Volume (0–100, default 70, a placeholder) and Mute are kept in the profile and set on Options. Muted, the game never opens the browser's audio.

## The cues

| Cue | When |
|---|---|
| click | any button |
| card | a card is played |
| draw | cards are drawn |
| ultimate | an ultimate fires |
| transcend | a character Transcends |
| enemy | an enemy acts |
| hit | a party hit lands |
| crit | a party hit crits |
| tentacle | each Tentacle hit |
| tick | Bleed or Poison deals damage |
| hurt | the party takes a hit |
| block | a hit lands wholly on Shield |
| shield | Shield gained |
| heal | HP healed |
| status | a status applied |
| fall | an enemy falls |
| phase | a Boss's bar breaks |
| victory / loss | the fight ends |
| pull / ssr | banner results show, with an SSR among them |

## Picks (owner, 21 Nov)

All from Kenney (kenney.nl), CC0: no credit needed. The packs sit in `.external/`, which git ignores.

| Cue | File | Pack |
|---|---|---|
| click | click_001 | Interface Sounds |
| card | card-slide-3 | Casino Audio |
| draw | card-slide-5 | Casino Audio |
| ultimate | impactBell_heavy_000 (none fit well; kept after round 2) | Impact Sounds |
| transcend | impactBell_heavy_003 (round 2's rising sweep came closest but sounded sci-fi) | Impact Sounds |
| enemy | drawKnife3, cut to 0.30s (round 2; not an attack yet, but better) | RPG Audio |
| hit | impactSoft_heavy_000 | Impact Sounds |
| crit | impactPlate_heavy_000 | Impact Sounds |
| tentacle | footstep_grass_000, and _001–_004 taking turns (judge in game) | Impact Sounds |
| tick | impactSoft_medium_003 | Impact Sounds |
| hurt | impactSoft_heavy_002 | Impact Sounds |
| block | impactPlate_medium_000 | Impact Sounds |
| shield | impactPlate_light_000 | Impact Sounds |
| heal | none: glass chimes too sharp, the tones sci-fi (rounds 1 and 2) | |
| status | handleSmallLeather; silent when a hit sounds at the same moment | RPG Audio |
| fall | dropLeather, lowered: a body hitting the floor (round 2) | RPG Audio |
| phase | impactBell_heavy_002 | Impact Sounds |
| victory | handleCoins | RPG Audio |
| loss | minimize_008 | Interface Sounds |
| pull | cards-pack-open-1 | Casino Audio |
| ssr | confirmation_002 | Interface Sounds |

The owner asked about overlaps. An enemy's lunge connects 0.13s after it starts. Round 1's swish was cut to end there; round 2's knife draw (0.30s) runs on under Hurt or Block, which the owner judges in play. Block replaces Hurt, never both. A status applied by a hit lands with it, so the status stays silent at that moment.

## Sourcing

Kenney's packs are CC0 (no credit needed) and cover most of this: Interface Sounds (click), Casino Audio (card, draw), Impact Sounds (hit, crit, hurt, block, fall), and RPG Audio (shield, heal, status). The site refuses scripted downloads, so the owner downloads the packs into `audio/raw/<pack>/`. I then propose two or three candidates per cue on a listening sheet, and the owner picks. Picks are copied into `src/assets/sound/` as `.ogg`, and each source and its licence is listed here.

## Open

- Round 2 done (owner, 27 Nov): enemy and fall replaced; ultimate kept. Transcend and heal still have no good fit in the Kenney packs, and enemy isn't an attack yet. These need other sources.
- Long Tentacle volleys sound every hit, 0.11s apart (owner to judge). Options if that's too much: quieter hits deeper into a volley, every second or third hit, or one rolling sound.
- The mix between cues, judged in play.
