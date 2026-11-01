import { applyStatus, summon } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { poison } from '../statuses/poison.ts';
import { seedling } from './pod-thrower.ts';

// Band 4, the Calyx (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Summoner: a ripe bladder hanging from an arching root-stalk. It drops Seedlings, two at most.
export const seedBladder = enemy({
  id: 'enemy.seed-bladder', name: 'Seed-Bladder', hp: 70, size: 'large',
  intents: [
    { id: 'drop', name: 'Drop', effects: [summon(seedling, 1, 2)] },
    { id: 'burst-spores', name: 'Burst Spores', effects: [applyStatus(poison, 6)] },
  ],
});
