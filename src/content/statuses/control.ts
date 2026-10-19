import { status } from '../define.ts';

// Control statuses on enemies. Elites and bosses resist control: Stun and Delay land as Falter.

export const stun = status({
  id: 'status.stun', stacking: 'highest', icon: 'stun', skipsAction: 'advance', resistedAs: 'status.falter',
  help: 'Skips its next action. That intent is lost; the next one is revealed.',
});

export const delay = status({
  id: 'status.delay', stacking: 'highest', icon: 'delay', skipsAction: 'hold', resistedAs: 'status.falter',
  help: 'Skips its next action. Its shown intent carries over to next turn.',
});

export const falter = status({
  id: 'status.falter', stacking: 'highest', icon: 'falter', endsAfterAction: true,
  help: 'Resisted control: its next action deals and shields 25% less.',
  modifiers: [
    { value: 'damage', step: 'outgoingMul', amount: 0.75 },
    { value: 'shield', step: 'outgoingMul', amount: 0.75 },
  ],
});
