import { status } from '../define.ts';

// Stacks are the other side's turns, the ones where it is hit, after the turn it lands in (owner, 19 Oct).
export const vulnerable = status({
  id: 'status.vulnerable', stacking: 'add', icon: 'vulnerable', lasts: 'opposingTurns',
  help: "Takes 50% more damage. Lasts this many of the other side's turns, after the one it lands in.",
  modifiers: [{ value: 'damage', step: 'incomingMul', amount: 1.5 }],
});
