import { status } from '../define.ts';

// The Cocooned Scout's own ward (owner, 31 Oct): it lasts until the Scout's next action. Damage
// passes it by; statuses still land, and Poison and Bleed still tick. A Rouse is separate.
export const cocooned = status({
  id: 'status.cocooned', stacking: 'highest', endsAfterAction: true, wardsDamage: true,
  help: 'Takes no damage until its next action. Statuses still land and tick.',
});
