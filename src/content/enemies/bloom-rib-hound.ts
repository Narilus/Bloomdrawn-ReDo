import { damage, gainShield } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Level-1 numbers retuned (owner, 31 Oct) against an Average build: see docs/notes/m6-depth.md, "The depth model".
// The M1 fight's enemy (docs/notes/starter-kits.md): an attacker whose intents cycle in order.
export const bloomRibHound = enemy({
  id: 'enemy.bloom-rib-hound', name: 'Bloom-Rib Hound', hp: 160,
  intents: [
    { id: 'bite', name: 'Bite', effects: [damage(31, { target: 'party' })] },
    { id: 'bristle', name: 'Bristle', effects: [gainShield(7), damage(16, { target: 'party' })] },
    { id: 'maul', name: 'Maul', effects: [damage(47, { target: 'party' })] },
  ],
});
