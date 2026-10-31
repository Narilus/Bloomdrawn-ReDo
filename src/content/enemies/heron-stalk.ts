import { damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 2, the Thicket (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Attacker: two herons fused on one pair of legs, their stem-necks twisted together.
export const heronStalk = enemy({
  id: 'enemy.heron-stalk', name: 'Heron-Stalk', hp: 60,
  intents: [
    { id: 'spear-strike', name: 'Spear Strike', effects: [damage(30, { target: 'party' })] },
    { id: 'wade', name: 'Wade', effects: [gainShield(12)] },
    { id: 'snap', name: 'Snap', effects: [damage(52, { target: 'party' })] },
  ],
});
