import { applyStatus, clearStatuses, damage, summon, type IntentDef, type PhaseDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';
import { heronStalk } from './heron-stalk.ts';
import { kit } from './litter-mound.ts';

// Band 2, the Thicket (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Boss: a colossus on four different legs with a closed peony for a head. Two bars; resists control.
// At Fruiting its second bar is Full Bloom instead of Many Heads.

const hits = (amount: number, times: number) => Array.from({ length: times }, () => damage(amount, { target: 'party' }));
const theRouse: IntentDef = { id: 'the-peony-opens', name: 'The Peony Opens', effects: [clearStatuses()] };

const gathered: IntentDef[] = [
  { id: 'trample', name: 'Trample', effects: [damage(58, { target: 'party' })] },
  { id: 'bellow', name: 'Bellow', effects: [applyStatus(weak, 2)] },
  { id: 'call-the-thicket', name: 'Call the Thicket', effects: [summon(heronStalk, 2, 2)] },
];

/** Its first bar is Gathered; `second` is its second bar. */
const beast = (id: string, second: PhaseDef) =>
  enemy({ id, name: 'The Gathered Beast', hp: 1050, size: 'huge', traits: ['resistsControl'], intents: gathered, phases: [second] });

export const gatheredBeast = beast('enemy.gathered-beast', {
  name: 'Many Heads', hp: 1050, rouse: theRouse,
  intents: [
    { id: 'three-heads', name: 'Three Heads', effects: hits(26, 3) },
    { id: 'rend', name: 'Rend', effects: [applyStatus(vulnerable, 2)] },
    { id: 'gore', name: 'Gore', effects: [damage(90, { target: 'party' })] },
  ],
});

export const gatheredBeastFullBloom = beast('enemy.gathered-beast-full-bloom', {
  name: 'Full Bloom', hp: 1050, rouse: theRouse,
  intents: [
    { id: 'brood', name: 'Brood', effects: [summon(kit, 2, 2)] },
    { id: 'many-heads', name: 'Many Heads', effects: hits(26, 4) },
    { id: 'gore', name: 'Gore', effects: [damage(100, { target: 'party' })] },
  ],
});
