import { applyStatus, clearStatuses, damage, summon, type IntentDef, type PhaseDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';
import { rootSwornNovice } from './root-sworn-novice.ts';

// The M4 Boss (docs/notes/m4-run.md): the Bloom cult's abbess, half taken into a root-tree. Two HP
// bars of 200; resists control. At Fruiting her second phase is Full Bloom instead of Rooted.
// Numbers are placeholders; her damage was raised after the owner's first win (24 Oct).

const callTheFaithful: IntentDef = { id: 'call-the-faithful', name: 'Call the Faithful', effects: [summon(rootSwornNovice, 2, 2)] };

const sermon: IntentDef[] = [
  { id: 'censer-sermon', name: 'Censer Sermon', effects: [applyStatus(weak, 2)] },
  { id: 'crozier-blow', name: 'Crozier Blow', effects: [damage(20, { target: 'party' })] },
  callTheFaithful,
];

/** Her first bar is the Sermon; `second` is her second bar. */
const abbess = (id: string, second: PhaseDef) =>
  enemy({ id, name: 'The Hollow Abbess', hp: 200, size: 'huge', traits: ['resistsControl'], intents: sermon, phases: [second] });

export const hollowAbbess = abbess('enemy.hollow-abbess', {
  name: 'Rooted', hp: 200,
  rouse: { id: 'taking-root', name: 'Taking Root', effects: [clearStatuses()] },
  intents: [
    { id: 'root-lash', name: 'Root Lash', effects: [damage(10, { target: 'party' }), damage(10, { target: 'party' })] },
    { id: 'grasping-roots', name: 'Grasping Roots', effects: [applyStatus(vulnerable, 2)] },
    { id: 'bloom-burst', name: 'Bloom Burst', effects: [damage(34, { target: 'party' })] },
  ],
});

export const hollowAbbessFullBloom = abbess('enemy.hollow-abbess-full-bloom', {
  name: 'Full Bloom', hp: 200,
  rouse: { id: 'blossoming', name: 'Blossoming', effects: [clearStatuses()] },
  intents: [
    { id: 'root-lash', name: 'Root Lash', effects: [damage(10, { target: 'party' }), damage(10, { target: 'party' }), damage(10, { target: 'party' })] },
    { id: 'pollen-choir', name: 'Pollen Choir', effects: [applyStatus(weak, 2), applyStatus(vulnerable, 2)] },
    callTheFaithful,
    { id: 'bloom-burst', name: 'Bloom Burst', effects: [damage(40, { target: 'party' })] },
  ],
});
