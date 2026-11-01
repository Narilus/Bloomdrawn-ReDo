import { damage, foretell, gainShield, wither, type IntentDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Band 5, the source (docs/notes/bestiary.md). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Countdown: a stitched seed-husk. Ripen shows the Burst a turn ahead; Shield blocks the Burst, and
// killing the Husk first cancels it. Nothing happens on its death (bestiary-direction.md 2.2).
// Sown by the Seed-Mother or the Mother Root, it stands small beside them. Two sown together
// stagger: the second arrives Delayed, so their Bursts come a turn apart (owner, 1 Nov).

const intents: IntentDef[] = [
  { id: 'harden', name: 'Harden', effects: [gainShield(20)] },
  { id: 'ripen', name: 'Ripen', effects: [foretell()] },
  { id: 'burst', name: 'Burst', effects: [damage(90, { target: 'party' }), wither()] },
];

export const gardenHusk = enemy({ id: 'enemy.garden-husk', name: 'Garden Husk', hp: 75, size: 'large', intents });

export const sownHusk = enemy({ id: 'enemy.sown-husk', name: 'Garden Husk', hp: 75, size: 'small', intents });
