import { damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Defender: shields itself and its allies.
export const rootMat = enemy({
  id: 'enemy.root-mat', name: 'Root-Mat', hp: 90,
  intents: [
    { id: 'thicken', name: 'Thicken', effects: [gainShield(14)] },
    { id: 'lash', name: 'Lash', effects: [damage(7, { target: 'party' })] },
    { id: 'shelter', name: 'Shelter', effects: [gainShield(6, 'allies')] },
  ],
});
