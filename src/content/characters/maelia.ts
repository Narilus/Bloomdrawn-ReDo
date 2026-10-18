import { add, applyStatus, chargeUltimate, consumed, damage, gainResource, gainShield, heal, ifConsume, mul, repeatNext, resource, stat } from '../../engine/index.ts';
import { card, character } from '../define.ts';
import { poison } from '../statuses/poison.ts';

// Approved starter kit (docs/notes/starter-kits.md). Numbers are placeholders for tuning.

export const strike = card({
  id: 'maelia.strike', name: 'Strike', owner: 'maelia', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(add(6, stat('attack')))],
});

export const defense = card({
  id: 'maelia.defense', name: 'Defense', owner: 'maelia', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(add(5, stat('defense')))],
});

export const swollenPod = card({
  id: 'maelia.swollen-pod', name: 'Swollen Pod', owner: 'maelia', slot: 'flavourA', cost: 2, target: 'allEnemies',
  effects: [gainResource('embryo', 3), applyStatus(poison, 2, 'allEnemies')],
  text: 'Gain {effects.0.amount} Embryo. Apply {effects.1.stacks} Poison to all enemies.',
});

export const budCutting = card({
  id: 'maelia.bud-cutting', name: 'Bud Cutting', owner: 'maelia', slot: 'flavourB', cost: 3, target: 'none',
  effects: [repeatNext(), ifConsume('embryo', 2, [chargeUltimate(10, 'party')])],
  text: "The next card you play this turn resolves twice. Consume {effects.1.amount} Embryo: charge every party member's ultimate by {effects.1.branch.0.amount}.",
});

export const maelia = character({
  id: 'maelia', name: 'Maelia', domain: 'flesh',
  stats: { hp: 55, attack: 3, defense: 5 },
  cards: [strike, defense, swollenPod, budCutting],
  passive: {
    name: "Midwife's Hands", scope: 'combat',
    text: 'The first time each turn a card gains Embryo, gain {triggers.0.do.0.amount} more.',
    triggers: [{ on: 'resourceGained', filter: { resource: 'embryo', direct: true }, once: 'turn', do: [gainResource('embryo', 1)] }],
  },
  ultimate: {
    name: 'Birthing Bloom',
    text: 'Consume all Embryo. The party heals {effects.0.branch.0.amount.mul.0} and gains {effects.0.branch.1.amount.mul.0} Shield per Embryo consumed.',
    effects: [ifConsume('embryo', resource('embryo'), [heal(mul(3, consumed())), gainShield(mul(4, consumed()))])],
  },
});
