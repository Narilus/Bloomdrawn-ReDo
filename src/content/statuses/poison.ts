import { loseHp, stacks } from '../../engine/index.ts';
import { status } from '../define.ts';

// Damage equal to stacks at end of turn, after Tentacles; it does not decay. HP loss ignores Shield.
export const poison = status({
  id: 'status.poison', stacking: 'add',
  triggers: [{ on: 'statusTick', do: [loseHp(stacks('status.poison'))] }],
});
