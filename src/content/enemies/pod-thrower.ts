import { damage, summon } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Level-1 numbers retuned (owner, 31 Oct) against an Average build: see docs/notes/m6-depth.md, "The depth model".
// Summoner: sows Seedlings, at most two alive.
export const seedling = enemy({
  id: 'enemy.seedling', name: 'Seedling', hp: 13, size: 'small',
  intents: [{ id: 'nip', name: 'Nip', effects: [damage(14, { target: 'party' })] }],
});

export const podThrower = enemy({
  id: 'enemy.pod-thrower', name: 'Pod-Thrower', hp: 40,
  intents: [
    { id: 'lob', name: 'Lob', effects: [damage(24, { target: 'party' })] },
    { id: 'sow', name: 'Sow', effects: [summon(seedling, 1, 2)] },
    { id: 'lob-again', name: 'Lob', effects: [damage(24, { target: 'party' })] },
  ],
});
