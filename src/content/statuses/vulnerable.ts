import { reduceStacks } from '../../engine/index.ts';
import { status } from '../define.ts';

// Stacks are turns; one comes off at the end of its bearer's own turn (owner, 19 Oct).
export const vulnerable = status({
  id: 'status.vulnerable', stacking: 'add', icon: 'vulnerable',
  help: 'Takes 50% more damage. Lasts this many turns.',
  modifiers: [{ value: 'damage', step: 'incomingMul', amount: 1.5 }],
  triggers: [{ on: 'turnCountTick', filter: { target: 'self' }, do: [reduceStacks('status.vulnerable')] }],
});
