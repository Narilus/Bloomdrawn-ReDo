import { reduceStacks } from '../../engine/index.ts';
import { status } from '../define.ts';

// Stacks are turns; one comes off at the end of its side's turn.
export const vulnerable = status({
  id: 'status.vulnerable', stacking: 'add', icon: 'vulnerable',
  help: 'Takes 50% more damage. Lasts this many turns.',
  modifiers: [{ value: 'damage', step: 'incomingMul', amount: 1.5 }],
  triggers: [{ on: 'statusTick', filter: { target: 'self' }, do: [reduceStacks('status.vulnerable')] }],
});
