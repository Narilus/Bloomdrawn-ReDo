import { mul, stacks } from '../../engine/index.ts';
import { status } from '../define.ts';

// The Veiled Hierophant's Trial (docs/notes/trials.md): her Sermon raises every hit of every enemy,
// her Limbs' Lashes included.
export const fervour = status({
  id: 'status.fervour', stacking: 'add', icon: 'attack',
  help: 'Each hit deals more for each Fervour. It never wears off.',
  modifiers: [{ value: 'damage', step: 'flat', amount: mul(6, stacks('status.fervour')) }],
});
