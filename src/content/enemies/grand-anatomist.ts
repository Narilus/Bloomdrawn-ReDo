import { applyStatus, clearStatuses, damage, gainShield, heal, mul, reduceStacks, stacks, type IntentDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { bleed } from '../statuses/bleed.ts';
import { gestation } from '../statuses/gestation.ts';

// Trials (docs/notes/trials.md): Flesh's boss, build and burst. Level-1 numbers are placeholders
// scaled by the tier's level and fitted by the lab. A surgeon-saint with six grafted arms who grows
// Gestation in her pod; Delivery spends it all in one hit, its total shown on her intent. Her second
// bar gestates twice a cycle, so its Delivery is twice the first's.
// Two bars; resists control. Her Rouse clears her Gestation, so breaking the first bar fast takes
// away what she grew.

const incision: IntentDef = { id: 'incision', name: 'Incision', effects: [damage(30, { target: 'party' }), applyStatus(bleed, 6)] };
const gestate = (n: number): IntentDef => ({ id: 'gestate', name: 'Gestate', effects: [applyStatus(gestation, n, 'self')] });
const delivery: IntentDef = { id: 'delivery', name: 'Delivery', effects: [damage(mul(20, stacks(gestation)), { target: 'party' }), reduceStacks(gestation, stacks(gestation))] };

export const grandAnatomist = enemy({
  id: 'enemy.grand-anatomist', name: 'The Grand Anatomist', hp: 1100, size: 'huge', traits: ['resistsControl'],
  intents: [incision, gestate(3), { id: 'suture', name: 'Suture', effects: [heal(40), gainShield(30)] }, delivery],
  phases: [{
    name: 'The Theatre', hp: 1100,
    rouse: { id: 'scrub-in', name: 'Scrub In', effects: [clearStatuses()] },
    intents: [gestate(3), incision, gestate(3), delivery],
  }],
});
