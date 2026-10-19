import { loseHp, reduceStacks, stacks } from '../../engine/index.ts';
import { status } from '../define.ts';

// Damage equal to stacks at the end of its side's turn, then −1. It bypasses Shield, unlike Poison.
export const bleed = status({
  id: 'status.bleed', stacking: 'add', icon: 'bleed',
  help: 'Takes damage equal to its Bleed at end of turn, ignoring Shield, then loses 1 Bleed.',
  triggers: [{ on: 'statusTick', filter: { target: 'self' }, do: [loseHp(stacks('status.bleed'), { status: 'status.bleed' }), reduceStacks('status.bleed')] }],
});
