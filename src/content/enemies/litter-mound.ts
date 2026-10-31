import { damage, summon } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 2, the Thicket (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Summoner: many hares grown into one mound under a peony. It sheds Kits, two at most.
export const kit = enemy({
  id: 'enemy.kit', name: 'Kit', hp: 14, size: 'small',
  intents: [{ id: 'nip', name: 'Nip', effects: [damage(14, { target: 'party' })] }],
});

export const litterMound = enemy({
  id: 'enemy.litter-mound', name: 'Litter-Mound', hp: 130,
  intents: [
    { id: 'shed', name: 'Shed', effects: [summon(kit, 1, 2)] },
    { id: 'smother', name: 'Smother', effects: [damage(34, { target: 'party' })] },
  ],
});
