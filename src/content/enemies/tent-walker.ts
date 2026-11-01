import { damage, gainShield, summon } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { seedling } from './pod-thrower.ts';

// Band 3, the Lost Expedition (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Summoner: a tent of stretched skin on six legs. It lets out Seedlings, two at most.
export const tentWalker = enemy({
  id: 'enemy.tent-walker', name: 'Tent-Walker', hp: 90,
  intents: [
    { id: 'open-the-flap', name: 'Open the Flap', effects: [summon(seedling, 1, 2)] },
    { id: 'collapse', name: 'Collapse', effects: [damage(36, { target: 'party' }), gainShield(12)] },
  ],
});
