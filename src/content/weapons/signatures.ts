import { add, cardHeld, eventAmount, gainResource, gainShield, manaDebtOwed, min, mul, stacks, stat } from '../../engine/index.ts';
import { pct, weapon } from '../define.ts';
import { bleed } from '../statuses/bleed.ts';
import { danceOfBells } from '../statuses/dance.ts';

// The eight signature weapons (docs/notes/weapons.md; owner, 14 Nov). Each is best on its character
// but names a mechanic, not a card, so a later character who shares it can use it. Effects say "the
// wielder". `p` is the reinforcement power, 1 at +0 to 1.5 at +5. Main stats are placeholders for the lab.

export const seedOrbStaff = weapon({
  id: 'weapon.seed-orb-staff', name: "Maelia's Seed-Orb Staff", rarity: 'ssr', signature: 'maelia',
  main: { stat: 'defense', amount: 30 },
  effect: (p) => ({
    text: `When the wielder consumes Embryo, the party gains Shield equal to ${pct(10 * p)}% of the wielder's Defense for each Embryo consumed.`,
    triggers: [{ on: 'resourceConsumed', filter: { source: 'self', resource: 'embryo' }, do: [gainShield(mul(0.1 * p, stat('defense'), eventAmount()))] }],
  }),
});

export const chalkCircleCenser = weapon({
  id: 'weapon.chalk-circle-censer', name: "Agathe's Chalk-Circle Censer", rarity: 'ssr', signature: 'agathe',
  main: { stat: 'attack', amount: 30 },
  effect: (p) => ({
    text: `The first time each turn the wielder gains Tentacles, Tentacles deal +${pct(10 * p)}% of the wielder's Attack for the rest of combat.`,
    triggers: [{ on: 'resourceGained', filter: { source: 'self', resource: 'tentacles' }, once: 'turn', do: [gainResource('potency', mul(0.1 * p, stat('attack')))] }],
  }),
});

export const vigilLamp = weapon({
  id: 'weapon.vigil-lamp', name: "Anthe's Vigil Lamp", rarity: 'ssr', signature: 'anthe',
  main: { stat: 'hp', amount: 30 },
  effect: (p) => ({
    text: `The wielder's Ritual cards deal ${pct(10 * p)}% more damage for each turn they've been held, up to 3 turns.`,
    modifiers: [{ value: 'damage', step: 'outgoingMul', keyword: 'ritual', amount: add(1, mul(0.1 * p, min(3, cardHeld()))) }],
  }),
});

export const sealedLedger = weapon({
  id: 'weapon.sealed-ledger', name: "Leonora's Sealed Ledger", rarity: 'ssr', signature: 'leonora',
  main: { stat: 'defense', amount: 30 },
  effect: (p) => ({
    text: `The wielder's cards that give Shield give extra Shield equal to ${pct(20 * p)}% of the wielder's Defense for each Mana owed.`,
    modifiers: [{ value: 'shield', step: 'flat', fromCard: true, amount: mul(0.2 * p, stat('defense'), manaDebtOwed()) }],
  }),
});

export const thornRapier = weapon({
  id: 'weapon.thorn-rapier', name: "Virelle's Thorn Rapier", rarity: 'ssr', signature: 'virelle',
  main: { stat: 'critDamage', amount: 24 },
  effect: (p) => ({
    text: `Bleed the wielder applies, from any source, is ${pct(20 * p)}% more.`,
    modifiers: [{ value: 'stacks', step: 'outgoingMul', status: bleed.id, amount: 1 + 0.2 * p }],
  }),
});

export const tornVeil = weapon({
  id: 'weapon.torn-veil', name: "Isadora's Torn Veil", rarity: 'ssr', signature: 'isadora',
  main: { stat: 'critRate', amount: 12 },
  effect: (p) => ({
    text: `While Dance of Bells is active, whoever used it, Tentacle hits have +${pct(15 * p)}% Crit Rate.`,
    modifiers: [{ value: 'critRate', step: 'flat', on: 'party', volley: true, amount: mul(15 * p, min(1, stacks(danceOfBells))) }],
  }),
});

export const foxfireGauntlet = weapon({
  id: 'weapon.foxfire-gauntlet', name: "Kibane's Foxfire Gauntlet", rarity: 'ssr', signature: 'kibane',
  main: { stat: 'attack', amount: 30 },
  effect: (p) => ({
    text: `The wielder's damage that consumes Essence is ${pct(20 * p)}% more.`,
    modifiers: [{ value: 'damage', step: 'outgoingMul', consumes: 'essence', amount: 1 + 0.2 * p }],
  }),
});

export const snareLine = weapon({
  id: 'weapon.snare-line', name: "Hester's Snare-Line", rarity: 'ssr', signature: 'hester',
  main: { stat: 'hp', amount: 30 },
  effect: (p) => ({
    text: `When an enemy skips an action or Falters, the party gains Shield equal to ${pct(10 * p)}% of the wielder's HP.`,
    triggers: [{ on: 'controlled', do: [gainShield(mul(0.1 * p, stat('hp')))] }],
  }),
});
