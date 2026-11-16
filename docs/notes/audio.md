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

## Sourcing

Kenney's packs are CC0 (no credit needed) and cover most of this: Interface Sounds (click), Casino Audio (card, draw), Impact Sounds (hit, crit, hurt, block, fall), and RPG Audio (shield, heal, status). The site refuses scripted downloads, so the owner downloads the packs into `audio/raw/<pack>/`. I then propose two or three candidates per cue on a listening sheet, and the owner picks. Picks are copied into `src/assets/sound/` as `.ogg`, and each source and its licence is listed here.

## Open

- Which packs, or other CC0 sources the owner prefers.
- The mix between cues, once there are sounds to hear.
