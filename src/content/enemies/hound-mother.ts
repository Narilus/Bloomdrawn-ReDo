import { damage, summon } from '../../engine/index.ts';
import { enemy } from '../define.ts';

// Level-1 numbers retuned (owner, 31 Oct) against an Average build: see docs/notes/m6-depth.md, "The depth model".
// Elite swarm: tests hitting many targets. Howls up whelps, two at most; resists control.
export const bloomRibWhelp = enemy({
  id: 'enemy.bloom-rib-whelp', name: 'Bloom-Rib Whelp', hp: 95, size: 'small',
  intents: [{ id: 'bite', name: 'Bite', effects: [damage(24, { target: 'party' })] }],
});

export const houndMother = enemy({
  id: 'enemy.hound-mother', name: 'Hound Mother', hp: 520, size: 'large', traits: ['resistsControl'],
  intents: [
    { id: 'howl', name: 'Howl', effects: [summon(bloomRibWhelp, 2, 2)] },
    { id: 'rend', name: 'Rend', effects: [damage(44, { target: 'party' })] },
    { id: 'howl-again', name: 'Howl', effects: [summon(bloomRibWhelp, 2, 2)] },
  ],
});
