import { applyStatus, damage } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { poison } from '../statuses/poison.ts';
import { weak } from '../statuses/weak.ts';

// Band 2, the Thicket (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Debuffer: a cloak-sized moth whose eyespots are closed buds.
export const mothMantle = enemy({
  id: 'enemy.moth-mantle', name: 'Moth-Mantle', hp: 50,
  intents: [
    { id: 'pollen-dust', name: 'Pollen Dust', effects: [applyStatus(weak, 2), applyStatus(poison, 4)] },
    { id: 'wing-beat', name: 'Wing Beat', effects: [damage(30, { target: 'party' })] },
  ],
});
