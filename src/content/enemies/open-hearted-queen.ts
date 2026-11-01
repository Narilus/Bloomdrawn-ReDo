import { applyStatus, clearStatuses, damage, drawFewer, repeat, stacks, summon, type IntentDef, type PhaseDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { bleed } from '../statuses/bleed.ts';
import { delay } from '../statuses/control.ts';
import { vines } from '../statuses/vines.ts';
import { heartBud } from './heart-bud.ts';

// Band 5, the source (docs/notes/bestiary.md). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Boss, and always the Boss at Depth 50 (owner, 1 Nov): a queen grown into her bone-and-root throne,
// her chest opened into a flower. She never strikes for herself; she welcomes you, and her Vines
// grow every cycle. She starts with 2. Two bars; resists control. Her Rouse clears her Vines, so
// breaking the first bar fast takes away what they grew. At Fruiting her second bar is Full Bloom.

const theVines: IntentDef = { id: 'the-vines', name: 'The Vines', effects: [repeat(stacks(vines), [damage(24, { target: 'party' })])] };
const bearTheCourt: IntentDef = { id: 'bear-the-court', name: 'Bear the Court', effects: [summon(heartBud, 2, 2, delay)] };
const ecstasy: IntentDef = { id: 'ecstasy', name: 'Ecstasy', effects: [applyStatus(vines, 3, 'self')] };
const lastEmbrace = (amount: number): IntentDef => ({ id: 'the-last-embrace', name: 'The Last Embrace', effects: [damage(amount, { target: 'party' })] });
const opensHerArms: IntentDef = { id: 'she-opens-her-arms', name: 'She Opens Her Arms', effects: [clearStatuses()] };

const enthroned: IntentDef[] = [
  { id: 'embrace', name: 'Embrace', effects: [drawFewer(1), applyStatus(vines, 1, 'self')] },
  theVines,
  bearTheCourt,
];

/** Her first bar is Enthroned; `second` is her second bar. */
const queenOf = (id: string, second: PhaseDef) =>
  enemy({
    id, name: 'The Open-Hearted Queen', hp: 1200, size: 'huge', traits: ['resistsControl'], intents: enthroned, phases: [second],
    triggers: [{ on: 'combatStart', do: [applyStatus(vines, 2, 'self')] }],
  });

export const openHeartedQueen = queenOf('enemy.open-hearted-queen', {
  name: 'Unveiled', hp: 1200, rouse: opensHerArms,
  intents: [ecstasy, theVines, { id: 'heartbeat', name: 'Heartbeat', effects: [applyStatus(bleed, 10)] }, lastEmbrace(130)],
});

export const openHeartedQueenFullBloom = queenOf('enemy.open-hearted-queen-full-bloom', {
  name: 'Full Bloom', hp: 1200, rouse: opensHerArms,
  intents: [bearTheCourt, ecstasy, theVines, lastEmbrace(145)],
});
