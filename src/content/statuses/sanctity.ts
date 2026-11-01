import { status } from '../define.ts';

// The Kirin Oracle's Trial (docs/notes/trials.md): what her Talismans chant into her. The Rite deals
// more for each, then spends it.
export const sanctity = status({
  id: 'status.sanctity', stacking: 'add', icon: 'essence',
  help: 'The Rite deals more for each Sanctity, then spends it all. It never wears off.',
});
