import { applyStatus } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { sanctity } from '../statuses/sanctity.ts';

// The Kirin Oracle's Talismans (docs/notes/trials.md): each one left hanging Chants a Sanctity into
// her every turn, and her Rite grows with it.
export const paperTalisman = enemy({
  id: 'enemy.paper-talisman', name: 'Paper Talisman', hp: 35, size: 'small',
  intents: [{ id: 'chant', name: 'Chant', effects: [applyStatus(sanctity, 1, 'leader')] }],
});
