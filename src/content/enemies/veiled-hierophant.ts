import { applyStatus, clearStatuses, damage, summon, type IntentDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { fervour } from '../statuses/fervour.ts';
import { weak } from '../statuses/weak.ts';
import { raisedLimb } from './raised-limb.ts';

// Trials (docs/notes/trials.md): Rapture's boss, count × damage. Level-1 numbers are placeholders
// scaled by the tier's level and fitted by the lab. She raises Tentacles (the count) and preaches
// Fervour into every enemy (the damage per hit): kill the Limbs or race the Sermon. Two bars;
// resists control. Her Rouse clears her own statuses; her Limbs keep theirs.

const sermon = (n: number): IntentDef => ({ id: 'sermon', name: 'Sermon', effects: [applyStatus(fervour, n, 'allEnemies')] });

export const veiledHierophant = enemy({
  id: 'enemy.veiled-hierophant', name: 'The Veiled Hierophant', hp: 1000, size: 'huge', traits: ['resistsControl'],
  intents: [
    { id: 'raise-a-limb', name: 'Raise a Limb', effects: [summon(raisedLimb, 1, 3)] },
    sermon(1),
    { id: 'censer', name: 'Censer', effects: [applyStatus(weak, 2)] },
  ],
  phases: [{
    name: 'Compline', hp: 1000,
    rouse: { id: 'the-veil-lifts', name: 'The Veil Lifts', effects: [clearStatuses()] },
    intents: [
      { id: 'raise-two-limbs', name: 'Raise Two Limbs', effects: [summon(raisedLimb, 2, 3)] },
      sermon(2),
      { id: 'communion', name: 'Communion', effects: [damage(90, { target: 'party' })] },
    ],
  }],
});
