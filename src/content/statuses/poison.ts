import { loseHp, stacks } from '../../engine/index.ts';
import { status } from '../define.ts';

// Damage equal to stacks at end of turn, after Tentacles; it does not decay. Shield blocks it;
// modifiers don't change it.
export const poison = status({
  id: 'status.poison', stacking: 'add', icon: 'poison',
  help: 'Takes damage equal to its Poison at end of turn. Shield blocks it. It does not wear off.',
  triggers: [{ on: 'statusTick', do: [loseHp(stacks('status.poison'), { blockedByShield: true })] }],
});
