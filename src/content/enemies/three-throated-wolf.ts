import { damage } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 2, the Thicket (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Elite: tests slow setups. Each bite harder than the last, then all three jaws, then again; resists control.
export const threeThroatedWolf = enemy({
  id: 'enemy.three-throated-wolf', name: 'Three-Throated Wolf', hp: 800, size: 'large', traits: ['resistsControl'],
  intents: [
    { id: 'bite', name: 'Bite', effects: [damage(25, { target: 'party' })] },
    { id: 'deeper-bite', name: 'Deeper Bite', effects: [damage(40, { target: 'party' })] },
    { id: 'savage-bite', name: 'Savage Bite', effects: [damage(55, { target: 'party' })] },
    { id: 'three-jaws', name: 'Three Jaws', effects: [damage(32, { target: 'party' }), damage(32, { target: 'party' }), damage(32, { target: 'party' })] },
  ],
});
