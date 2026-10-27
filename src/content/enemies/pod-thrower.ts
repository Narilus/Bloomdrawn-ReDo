import { damage, summon } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Summoner: sows Seedlings, at most two alive.
export const seedling = enemy({
  id: 'enemy.seedling', name: 'Seedling', hp: 21, size: 'small',
  intents: [{ id: 'nip', name: 'Nip', effects: [damage(4, { target: 'party' })] }],
});

export const podThrower = enemy({
  id: 'enemy.pod-thrower', name: 'Pod-Thrower', hp: 63,
  intents: [
    { id: 'lob', name: 'Lob', effects: [damage(7, { target: 'party' })] },
    { id: 'sow', name: 'Sow', effects: [summon(seedling, 1, 2)] },
    { id: 'lob-again', name: 'Lob', effects: [damage(7, { target: 'party' })] },
  ],
});
