import { applyStatus, damage, gainShield, type IntentDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { poison } from '../statuses/poison.ts';
import { weak } from '../statuses/weak.ts';

// Band 4, the Calyx (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Debuffer: a bee grown from a flower, its belly a lantern of thin lit skin. The art is wide, so
// beside a larger anchor (the Queen, the Pistil) it stands small, clear of the party and the screen
// edge. Beside the Queen it is an attendant with more HP that also Shields her, the ally with the most max HP.

const pollenCloud: IntentDef = { id: 'pollen-cloud', name: 'Pollen Cloud', effects: [applyStatus(poison, 4), applyStatus(weak, 2)] };
const sting: IntentDef = { id: 'sting', name: 'Sting', effects: [damage(30, { target: 'party' })] };

export const pollinator = enemy({ id: 'enemy.pollinator', name: 'Pollinator', hp: 50, size: 'large', intents: [pollenCloud, sting] });

export const flankingPollinator = enemy({ id: 'enemy.flanking-pollinator', name: 'Pollinator', hp: 50, size: 'small', intents: [pollenCloud, sting] });

export const attendingPollinator = enemy({
  id: 'enemy.attending-pollinator', name: 'Pollinator', hp: 90, size: 'small',
  intents: [pollenCloud, sting, { id: 'attend', name: 'Attend', effects: [gainShield(25, 'largestAlly')] }],
});
