import { applyStatus, damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { vulnerable } from '../statuses/vulnerable.ts';

// Level-1 numbers retuned (owner, 31 Oct) against an Average build: see docs/notes/m6-depth.md, "The depth model".
// The Hollow Abbess's own adds (owner, 24 Oct: tougher than the Acolytes, and in the way): they
// shield every enemy, the Abbess included, and leave the party Vulnerable. Numbers are placeholders.
export const rootSwornNovice = enemy({
  id: 'enemy.root-sworn-novice', name: 'Root-Sworn Novice', hp: 165,
  intents: [
    { id: 'kneeling-prayer', name: 'Kneeling Prayer', effects: [gainShield(25, 'allies')] },
    { id: 'bitter-incense', name: 'Bitter Incense', effects: [applyStatus(vulnerable, 1)] },
    { id: 'thorn-rosary', name: 'Thorn Rosary', effects: [damage(21, { target: 'party' })] },
  ],
});
