import { damage, heal } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 4, the Calyx (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Elite: tests kill order. Two attending Pollinators Shield her; she heals herself; resists control.
export const pollenQueen = enemy({
  id: 'enemy.pollen-queen', name: 'The Pollen Queen', hp: 450, size: 'large', traits: ['resistsControl'],
  intents: [
    { id: 'crush', name: 'Crush', effects: [damage(70, { target: 'party' })] },
    { id: 'royal-jelly', name: 'Royal Jelly', effects: [heal(50)] },
  ],
});
