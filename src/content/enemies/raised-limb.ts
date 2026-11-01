import { damage } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// The Veiled Hierophant's Tentacles (docs/notes/trials.md): small, and each Lashes every turn, so
// her count grows unless you cut it down. Her Sermon's Fervour raises every Lash.
export const raisedLimb = enemy({
  id: 'enemy.raised-limb', name: 'Raised Limb', hp: 40, size: 'small',
  intents: [{ id: 'lash', name: 'Lash', effects: [damage(12, { target: 'party' })] }],
});
