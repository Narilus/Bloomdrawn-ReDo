import { applyStatus, clearStatuses, damage, drawFewer, manaDebt, repeat, summon, type IntentDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { delay } from '../statuses/control.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { marionette } from './marionette.ts';

// Trials (docs/notes/trials.md): Unbound's boss, the economy. Level-1 numbers are placeholders
// scaled by the tier's level and fitted by the lab. He takes your cards and your Mana, the Unbound
// trade turned on you, while his Marionettes Shield him. In the Main Act his Vulnerable carries the
// knives and wears off before the Finale, and the Mana he takes is the turn before it. Two bars; resists control; his Rouse clears his statuses.

const whipCrack: IntentDef = { id: 'whip-crack', name: 'Whip Crack', effects: [damage(45, { target: 'party' }), applyStatus(vulnerable, 2)] };

export const ringmaster = enemy({
  id: 'enemy.ringmaster', name: 'The Ringmaster', hp: 1000, size: 'huge', traits: ['resistsControl'],
  intents: [
    whipCrack,
    { id: 'sleight-of-hand', name: 'Sleight of Hand', effects: [drawFewer(2)] },
    { id: 'raise-the-marionettes', name: 'Raise the Marionettes', effects: [summon(marionette, 2, 2, delay)] },
  ],
  phases: [{
    name: 'The Main Act', hp: 1000,
    rouse: { id: 'the-main-act', name: 'The Main Act', effects: [clearStatuses()] },
    intents: [
      whipCrack,
      { id: 'knife-thrower', name: 'Knife-Thrower', effects: [repeat(5, [damage(15, { target: 'party' })])] },
      { id: 'toll-the-house', name: 'Toll the House', effects: [manaDebt(2)] },
      { id: 'grand-finale', name: 'Grand Finale', effects: [damage(110, { target: 'party' })] },
    ],
  }],
});
