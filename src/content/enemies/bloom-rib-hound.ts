import { damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// The M1 fight's enemy (docs/notes/starter-kits.md): an attacker whose intents cycle in order.
export const bloomRibHound = enemy({
  id: 'enemy.bloom-rib-hound', name: 'Bloom-Rib Hound', hp: 150,
  intents: [
    { id: 'bite', name: 'Bite', effects: [damage(12, { target: 'party' })] },
    { id: 'bristle', name: 'Bristle', effects: [gainShield(10), damage(6, { target: 'party' })] },
    { id: 'maul', name: 'Maul', effects: [damage(18, { target: 'party' })] },
  ],
});
