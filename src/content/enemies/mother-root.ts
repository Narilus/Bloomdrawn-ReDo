import { applyStatus, clearStatuses, damage, summon, type IntentDef, type PhaseDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { delay } from '../statuses/control.ts';
import { poison } from '../statuses/poison.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';
import { sownHusk } from './garden-husk.ts';
import { grownPetalHorror } from './petal-horror.ts';

// Band 5, the source (docs/notes/bestiary.md). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Boss: the root-heart in its cracked stone basin. Two bars; resists control. At Fruiting her
// second bar is Full Bloom instead.

const hits = (amount: number, times: number) => Array.from({ length: times }, () => damage(amount, { target: 'party' }));
const opening: IntentDef = { id: 'opening', name: 'Opening', effects: [clearStatuses()] };

const beating: IntentDef[] = [
  { id: 'pulse', name: 'Pulse', effects: [applyStatus(poison, 4)] },
  { id: 'root-spear', name: 'Root Spear', effects: [damage(65, { target: 'party' })] },
  { id: 'grow', name: 'Grow', effects: [summon(grownPetalHorror, 1, 2)] },
];

/** Her first bar is Beating; `second` is her second bar. */
const motherRootOf = (id: string, second: PhaseDef) =>
  enemy({ id, name: 'The Mother Root', hp: 1150, size: 'huge', traits: ['resistsControl'], intents: beating, phases: [second] });

export const motherRoot = motherRootOf('enemy.mother-root', {
  name: 'Flowering Heart', hp: 1150, rouse: opening,
  intents: [
    { id: 'pollen-breath', name: 'Pollen Breath', effects: [applyStatus(weak, 2), applyStatus(vulnerable, 1)] },
    { id: 'petal-storm', name: 'Petal Storm', effects: hits(18, 4) },
    { id: 'heartbloom', name: 'Heartbloom', effects: [damage(90, { target: 'party' })] },
  ],
});

export const motherRootFullBloom = motherRootOf('enemy.mother-root-full-bloom', {
  name: 'Full Bloom', hp: 1150, rouse: opening,
  intents: [
    { id: 'fruit', name: 'Fruit', effects: [summon(sownHusk, 2, 2, delay)] },
    { id: 'petal-storm', name: 'Petal Storm', effects: hits(18, 5) },
    { id: 'heartbloom', name: 'Heartbloom', effects: [damage(100, { target: 'party' })] },
  ],
});
