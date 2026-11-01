import { damage, gainShield, heal } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 4, the Calyx (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Buffer: a made thing with secateur hands. Tend and Graft go where Suture's heal goes: a hurt Boss
// or summoner first, else the most hurt ally, else itself (owner, 1 Nov).
export const gardener = enemy({
  id: 'enemy.gardener', name: 'Gardener', hp: 55, size: 'large',
  intents: [
    { id: 'tend', name: 'Tend', effects: [heal(12, 'leaderFirst')] },
    { id: 'graft', name: 'Graft', effects: [gainShield(15, 'leaderFirst')] },
    { id: 'prune', name: 'Prune', effects: [damage(32, { target: 'party' })] },
  ],
});
