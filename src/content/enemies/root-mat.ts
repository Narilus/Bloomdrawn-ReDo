import { damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Level-1 numbers retuned (owner, 31 Oct) against an Average build: see docs/notes/m6-depth.md, "The depth model".
// Defender: shields itself and its allies.
export const rootMat = enemy({
  id: 'enemy.root-mat', name: 'Root-Mat', hp: 65,
  intents: [
    { id: 'thicken', name: 'Thicken', effects: [gainShield(10)] },
    { id: 'lash', name: 'Lash', effects: [damage(42, { target: 'party' })] },
    { id: 'shelter', name: 'Shelter', effects: [gainShield(4, 'allies')] },
  ],
});
