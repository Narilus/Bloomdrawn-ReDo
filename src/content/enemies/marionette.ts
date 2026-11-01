import { damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// The Ringmaster's Marionettes (docs/notes/trials.md): born in pairs, the second a step behind, so
// one Dances while the other Bows Shield onto him.
export const marionette = enemy({
  id: 'enemy.marionette', name: 'Marionette', hp: 50, size: 'small',
  intents: [
    { id: 'dance', name: 'Dance', effects: [damage(20, { target: 'party' })] },
    { id: 'bow', name: 'Bow', effects: [gainShield(20, 'leader')] },
  ],
});
