import { damage, gainShield, heal } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Buffer: heals and shields its allies (owner, 19 Oct: Shield and heal for now).
export const lanternSurveyor = enemy({
  id: 'enemy.lantern-surveyor', name: 'Lantern Surveyor', hp: 78,
  intents: [
    { id: 'tend', name: 'Tend', effects: [heal(10, 'lowestAlly')] },
    { id: 'signal', name: 'Signal', effects: [gainShield(5, 'allies')] },
    { id: 'lantern-swing', name: 'Lantern Swing', effects: [damage(8, { target: 'party' })] },
  ],
});
