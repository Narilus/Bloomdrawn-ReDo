import { damage, gainShield, summon } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { sownHusk } from './garden-husk.ts';

// Band 5, the source (docs/notes/bestiary.md). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Elite: tests a countdown. A woman of woven root carrying seed-husks in a sling; she sows them,
// two at most, and Shields every enemy. Resists control.
export const seedMother = enemy({
  id: 'enemy.seed-mother', name: 'The Seed-Mother', hp: 700, size: 'large', traits: ['resistsControl'],
  intents: [
    { id: 'sow', name: 'Sow', effects: [summon(sownHusk, 2, 2)] },
    { id: 'root-slam', name: 'Root Slam', effects: [damage(50, { target: 'party' })] },
    { id: 'nurture', name: 'Nurture', effects: [gainShield(20, 'allies')] },
  ],
});
