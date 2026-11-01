import { damage } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 4, the Calyx (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Attacker: a grazing body high on stilt legs, sleeping faces budding along its flanks.
export const stiltGrazer = enemy({
  id: 'enemy.stilt-grazer', name: 'Stilt-Grazer', hp: 125, size: 'large',
  intents: [
    { id: 'trample', name: 'Trample', effects: [damage(60, { target: 'party' })] },
    { id: 'graze', name: 'Graze', effects: [damage(30, { target: 'party' })] },
  ],
});
