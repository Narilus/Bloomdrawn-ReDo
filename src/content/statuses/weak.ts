import { status } from '../define.ts';

// Stacks are the bearer's own turns, the ones where it attacks, after the turn it lands in (owner, 19 Oct).
export const weak = status({
  id: 'status.weak', stacking: 'add', icon: 'weak', lasts: 'ownTurns',
  help: 'Deals 25% less damage. Lasts this many of its own turns, after the one it lands in.',
  modifiers: [{ value: 'damage', step: 'outgoingMul', amount: 0.75 }],
});
