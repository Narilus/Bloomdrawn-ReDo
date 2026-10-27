import { applyStatus, clearStatuses, damage, summon, type IntentDef, type PhaseDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';
import { rootSwornNovice } from './root-sworn-novice.ts';

// The M4 Boss (docs/notes/m4-run.md): the Bloom cult's abbess, half taken into a root-tree. Two HP
// bars of 500 (owner, 27 Oct); resists control. At Fruiting her second phase is Full Bloom instead of Rooted.
// Numbers are placeholders; her damage was raised twice after the owner's wins (24 Oct), and by
// another 10% on 27 Oct.

const callTheFaithful: IntentDef = { id: 'call-the-faithful', name: 'Call the Faithful', effects: [summon(rootSwornNovice, 2, 2)] };

const sermon: IntentDef[] = [
  { id: 'censer-sermon', name: 'Censer Sermon', effects: [applyStatus(weak, 2)] },
  { id: 'crozier-blow', name: 'Crozier Blow', effects: [damage(26, { target: 'party' })] },
  callTheFaithful,
];

/** Her first bar is the Sermon; `second` is her second bar. */
const abbess = (id: string, second: PhaseDef) =>
  enemy({ id, name: 'The Hollow Abbess', hp: 500, size: 'huge', traits: ['resistsControl'], intents: sermon, phases: [second] });

export const hollowAbbess = abbess('enemy.hollow-abbess', {
  name: 'Rooted', hp: 500,
  rouse: { id: 'taking-root', name: 'Taking Root', effects: [clearStatuses()] },
  intents: [
    { id: 'root-lash', name: 'Root Lash', effects: [damage(13, { target: 'party' }), damage(13, { target: 'party' })] },
    { id: 'grasping-roots', name: 'Grasping Roots', effects: [applyStatus(vulnerable, 2)] },
    { id: 'bloom-burst', name: 'Bloom Burst', effects: [damage(44, { target: 'party' })] },
  ],
});

export const hollowAbbessFullBloom = abbess('enemy.hollow-abbess-full-bloom', {
  name: 'Full Bloom', hp: 500,
  rouse: { id: 'blossoming', name: 'Blossoming', effects: [clearStatuses()] },
  intents: [
    { id: 'root-lash', name: 'Root Lash', effects: [damage(13, { target: 'party' }), damage(13, { target: 'party' }), damage(13, { target: 'party' })] },
    { id: 'pollen-choir', name: 'Pollen Choir', effects: [applyStatus(weak, 2), applyStatus(vulnerable, 2)] },
    callTheFaithful,
    { id: 'bloom-burst', name: 'Bloom Burst', effects: [damage(51, { target: 'party' })] },
  ],
});
