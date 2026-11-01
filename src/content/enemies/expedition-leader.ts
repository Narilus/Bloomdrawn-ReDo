import { applyStatus, clearStatuses, damage, gainShield, heal, summon, type IntentDef, type PhaseDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { fieldSurgeon } from './field-surgeon.ts';
import { packPorter } from './pack-porter.ts';

// Band 3, the Lost Expedition (docs/notes/bestiary.md; owner, 31 Oct). Level-1 numbers are placeholders fitted by `npm run lab:depth`.
// Boss: the man who made his crew, still mostly a man. What he did is never told (bestiary-direction.md 4.2).
// Two bars; resists control. At Fruiting his second bar is Full Bloom instead.

const hits = (amount: number, times: number) => Array.from({ length: times }, () => damage(amount, { target: 'party' }));
const theRouse: IntentDef = { id: 'he-opens-himself', name: 'He Opens Himself', effects: [clearStatuses()] };
const callTheCrew: IntentDef = { id: 'call-the-crew', name: 'Call the Crew', effects: [summon(packPorter, 1, 1), summon(fieldSurgeon, 1, 1)] };
const graft = (id: string): IntentDef => ({ id, name: 'Graft', effects: [gainShield(30, 'leaderFirst'), heal(20, 'leaderFirst')] });

const muster: IntentDef[] = [
  { id: 'bone-saw', name: 'Bone Saw', effects: [damage(60, { target: 'party' })] },
  { id: 'survey', name: 'Survey', effects: [applyStatus(vulnerable, 2)] },
  callTheCrew,
];

/** His first bar is the Muster; `second` is his second bar. */
const leader = (id: string, second: PhaseDef) =>
  enemy({ id, name: 'The Expedition Leader', hp: 1100, size: 'huge', traits: ['resistsControl'], intents: muster, phases: [second] });

export const expeditionLeader = leader('enemy.expedition-leader', {
  name: 'Opened', hp: 1100, rouse: theRouse,
  intents: [
    graft('graft'),
    { id: 'needle-threads', name: 'Needle Threads', effects: hits(24, 3) },
    { id: 'the-last-incision', name: 'The Last Incision', effects: [damage(105, { target: 'party' })] },
  ],
});

export const expeditionLeaderFullBloom = leader('enemy.expedition-leader-full-bloom', {
  name: 'Full Bloom', hp: 1100, rouse: theRouse,
  intents: [
    callTheCrew,
    graft('graft'),
    graft('graft-again'),
    { id: 'the-last-incision', name: 'The Last Incision', effects: [damage(115, { target: 'party' })] },
  ],
});
