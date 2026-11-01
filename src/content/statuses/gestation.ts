import { status } from '../define.ts';

// The Grand Anatomist's Trial (docs/notes/trials.md): what she grows in her pod. Delivery hits once
// for all of it, harder for each, and spends it.
export const gestation = status({
  id: 'status.gestation', stacking: 'add', icon: 'embryo',
  help: 'Delivery deals more for each Gestation, then spends it all. It never wears off.',
});
