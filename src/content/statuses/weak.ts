import { reduceStacks } from '../../engine/index.ts';
import { status } from '../define.ts';

// Stacks are turns; one comes off at the end of its side's turn.
export const weak = status({
  id: 'status.weak', stacking: 'add', icon: 'weak',
  help: 'Deals 25% less damage. Lasts this many turns.',
  modifiers: [{ value: 'damage', step: 'outgoingMul', amount: 0.75 }],
  triggers: [{ on: 'statusTick', filter: { target: 'self' }, do: [reduceStacks('status.weak')] }],
});
