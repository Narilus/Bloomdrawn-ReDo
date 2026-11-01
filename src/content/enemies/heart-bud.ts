import { applyStatus, heal } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { bleed } from '../statuses/bleed.ts';

// Band 5, the source (docs/notes/bestiary.md). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// The Open-Hearted Queen's brood: a stitched bud with a small heart glowing inside. Born in pairs,
// the second a step behind, so one Nourishes her while the other Beats.
export const heartBud = enemy({
  id: 'enemy.heart-bud', name: 'Heart-Bud', hp: 60, size: 'small',
  intents: [
    { id: 'nourish', name: 'Nourish', effects: [heal(30, 'leaderFirst')] },
    { id: 'beat', name: 'Beat', effects: [applyStatus(bleed, 6)] },
  ],
});
