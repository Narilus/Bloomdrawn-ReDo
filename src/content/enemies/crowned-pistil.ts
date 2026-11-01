import { applyStatus, clearStatuses, damage, gainShield, summon, type IntentDef, type PhaseDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { poison } from '../statuses/poison.ts';
import { weak } from '../statuses/weak.ts';
import { flankingPollinator } from './pollinator.ts';

// Band 4, the Calyx (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Boss: the flower the band grew from, crowned in stamens and gowned in petals. Two bars; resists
// control. At Fruiting her second bar is Full Bloom instead.

const hits = (amount: number, times: number) => Array.from({ length: times }, () => damage(amount, { target: 'party' }));
const thePetalsPart: IntentDef = { id: 'the-petals-part', name: 'The Petals Part', effects: [clearStatuses()] };
const pollenFall: IntentDef = { id: 'pollen-fall', name: 'Pollen Fall', effects: [applyStatus(poison, 6), applyStatus(weak, 2)] };
const callThePollinators: IntentDef = { id: 'call-the-pollinators', name: 'Call the Pollinators', effects: [summon(flankingPollinator, 2, 2)] };
const closeTheBud: IntentDef = { id: 'close-the-bud', name: 'Close the Bud', effects: [gainShield(60)] };

const crowned: IntentDef[] = [pollenFall, { id: 'stamen-lash', name: 'Stamen Lash', effects: [damage(60, { target: 'party' })] }, callThePollinators];

/** Her first bar is Crowned; `second` is her second bar. */
const pistil = (id: string, second: PhaseDef) =>
  enemy({ id, name: 'The Crowned Pistil', hp: 1100, size: 'huge', traits: ['resistsControl'], intents: crowned, phases: [second] });

export const crownedPistil = pistil('enemy.crowned-pistil', {
  name: 'Parted', hp: 1100, rouse: thePetalsPart,
  intents: [
    closeTheBud,
    { id: 'open', name: 'Open', effects: [damage(100, { target: 'party' })] },
    { id: 'stamen-lashes', name: 'Stamen Lash', effects: hits(28, 3) },
    pollenFall,
  ],
});

export const crownedPistilFullBloom = pistil('enemy.crowned-pistil-full-bloom', {
  name: 'Full Bloom', hp: 1100, rouse: thePetalsPart,
  intents: [
    closeTheBud,
    { id: 'open', name: 'Open', effects: [damage(110, { target: 'party' })] },
    callThePollinators,
    { id: 'stamen-lashes', name: 'Stamen Lash', effects: hits(28, 4) },
  ],
});
