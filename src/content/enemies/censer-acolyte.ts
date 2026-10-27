import { applyStatus, damage } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';

// Debuffer: Weak and Vulnerable land on the whole party.
export const censerAcolyte = enemy({
  id: 'enemy.censer-acolyte', name: 'Censer Acolyte', hp: 72,
  intents: [
    { id: 'smoke', name: 'Smoke', effects: [applyStatus(weak, 2)] },
    { id: 'censer-swing', name: 'Censer Swing', effects: [damage(9, { target: 'party' })] },
    { id: 'incense', name: 'Incense', effects: [applyStatus(vulnerable, 2)] },
  ],
});
