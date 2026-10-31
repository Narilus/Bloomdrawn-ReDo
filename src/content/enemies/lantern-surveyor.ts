import { damage, gainShield, heal } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Level-1 numbers retuned (owner, 31 Oct) against an Average build: see docs/notes/m6-depth.md, "The depth model".
// Buffer: heals and shields its allies (owner, 19 Oct: Shield and heal for now).
export const lanternSurveyor = enemy({
  id: 'enemy.lantern-surveyor', name: 'Lantern Surveyor', hp: 47,
  intents: [
    { id: 'tend', name: 'Tend', effects: [heal(6, 'lowestAlly')] },
    { id: 'signal', name: 'Signal', effects: [gainShield(3, 'allies')] },
    { id: 'lantern-swing', name: 'Lantern Swing', effects: [damage(27, { target: 'party' })] },
  ],
});
