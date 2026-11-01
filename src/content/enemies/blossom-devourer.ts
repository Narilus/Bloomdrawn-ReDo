import { damage, heal } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 5, the source (docs/notes/bestiary.md). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Attacker: a skull held in a great toothed flower on four tendril legs. It feeds as it bites.
export const blossomDevourer = enemy({
  id: 'enemy.blossom-devourer', name: 'Blossom Devourer', hp: 120, size: 'large',
  intents: [
    { id: 'gnash', name: 'Gnash', effects: [damage(50, { target: 'party' })] },
    { id: 'engulf', name: 'Engulf', effects: [damage(30, { target: 'party' }), heal(20)] },
  ],
});
