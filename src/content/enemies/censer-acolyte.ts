import { applyStatus, damage } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';

// Level-1 numbers retuned (owner, 31 Oct) against an Average build: see docs/notes/m6-depth.md, "The depth model".
// Debuffer: Weak and Vulnerable land on the whole party.
export const censerAcolyte = enemy({
  id: 'enemy.censer-acolyte', name: 'Censer Acolyte', hp: 50,
  intents: [
    { id: 'smoke', name: 'Smoke', effects: [applyStatus(weak, 2)] },
    { id: 'censer-swing', name: 'Censer Swing', effects: [damage(54, { target: 'party' })] },
    { id: 'incense', name: 'Incense', effects: [applyStatus(vulnerable, 2)] },
  ],
});
