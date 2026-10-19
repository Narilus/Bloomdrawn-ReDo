import { reduceStacks } from '../../engine/index.ts';
import { status } from '../define.ts';

// Stacks are turns; one comes off at the end of its bearer's own turn (owner, 19 Oct).
export const weak = status({
  id: 'status.weak', stacking: 'add', icon: 'weak',
  help: 'Deals 25% less damage. Lasts this many turns.',
  modifiers: [{ value: 'damage', step: 'outgoingMul', amount: 0.75 }],
  triggers: [{ on: 'turnCountTick', filter: { target: 'self' }, do: [reduceStacks('status.weak')] }],
});
