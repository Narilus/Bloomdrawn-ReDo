import { add, clearStatuses, damage, foretell, gainShield, mul, reduceStacks, stacks, summon, type IntentDef } from '../../engine/index.ts';
import { enemy } from '../define.ts';
import { sanctity } from '../statuses/sanctity.ts';
import { paperTalisman } from './paper-talisman.ts';

// Trials (docs/notes/trials.md): Spirit's boss, the delayed payoff. Level-1 numbers are placeholders
// scaled by the tier's level and fitted by the lab. Her Talismans chant Sanctity into her; Kindle
// names The Rite a turn ahead, and it grows with every Sanctity, then spends it. Kill the Talismans
// or race her. Two bars; resists control. Her Rouse clears her Sanctity.

const hangTalismans: IntentDef = { id: 'hang-talismans', name: 'Hang Talismans', effects: [summon(paperTalisman, 2, 2)] };
const kindle: IntentDef = { id: 'kindle', name: 'Kindle', effects: [foretell()] };
const theRite: IntentDef = {
  id: 'the-rite', name: 'The Rite',
  effects: [damage(add(40, mul(20, stacks(sanctity))), { target: 'party' }), reduceStacks(sanctity, stacks(sanctity))],
};

export const kirinOracle = enemy({
  id: 'enemy.kirin-oracle', name: 'The Kirin Oracle', hp: 1000, size: 'huge', traits: ['resistsControl'],
  intents: [hangTalismans, { id: 'hoof-strike', name: 'Hoof Strike', effects: [damage(50, { target: 'party' })] }, kindle, theRite],
  phases: [{
    name: 'Ascension', hp: 1000,
    rouse: { id: 'the-horn-unveiled', name: 'The Horn Unveiled', effects: [clearStatuses()] },
    intents: [hangTalismans, { id: 'tranquil-ward', name: 'Tranquil Ward', effects: [gainShield(60)] }, kindle, theRite],
  }],
});
