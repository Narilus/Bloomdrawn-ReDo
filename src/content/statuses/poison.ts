import { loseHp, stacks } from '../../engine/index.ts';
import { status } from '../define.ts';

// Damage equal to stacks on `statusTick` (an enemy's at the end of your turn, the party's after the enemy phase);
// it does not decay. Shield blocks it;
// modifiers don't change it.
export const poison = status({
  id: 'status.poison', stacking: 'add', icon: 'poison',
  help: 'Takes damage equal to its Poison at end of turn. Shield blocks it. It does not wear off.',
  triggers: [{ on: 'statusTick', filter: { target: 'self' }, do: [loseHp(stacks('status.poison'), { blockedByShield: true, status: 'status.poison' })] }],
});
