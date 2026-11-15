import {
  applyStatus,
  chargeUltimate,
  consumed,
  createCard,
  damage,
  eventAmount,
  gainResource,
  gainShield,
  heal,
  ifConsume,
  mul,
  percentOf,
  repeatNext,
  resource,
  stat,
  transcend,
} from '../../engine/index.ts';
import { card, character, p2, variant } from '../define.ts';
import { poison } from '../statuses/poison.ts';

// Approved starter kit (docs/notes/starter-kits.md). Numbers are placeholders for tuning.
// Flesh tuning (owner, 27 Oct): her Strike spends Embryo on Poison, and Poison stacks are four times their first numbers.

export const strike = card({
  id: 'maelia.strike', name: 'Strike', owner: 'maelia', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(mul(3, stat('attack'))), ifConsume('embryo', 1, [applyStatus(poison, mul(1.34, stat('attack')))])],
  text: 'Deal {effects.0.amount} damage. Consume {effects.1.amount} Embryo: apply {effects.1.branch.0.stacks} Poison.',
});

export const defense = card({
  id: 'maelia.defense', name: 'Defense', owner: 'maelia', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(mul(2, stat('defense')))],
});

export const swollenPod = card({
  id: 'maelia.swollen-pod', name: 'Swollen Pod', owner: 'maelia', slot: 'flavourA', cost: 2, target: 'allEnemies',
  effects: [gainResource('embryo', 3), applyStatus(poison, mul(2.67, stat('attack')), 'allEnemies')],
  text: 'Gain {effects.0.amount} Embryo. Apply {effects.1.stacks} Poison to all enemies.',
});

export const budCutting = card({
  id: 'maelia.bud-cutting', name: 'Bud Cutting', owner: 'maelia', slot: 'flavourB', cost: 3, target: 'none',
  effects: [repeatNext(), ifConsume('embryo', 2, [chargeUltimate(10, 'party')])],
  text: "The next card you play this turn resolves twice. Consume {effects.1.amount} Embryo: charge every party member's ultimate by {effects.1.branch.0.amount}.",
});

export const seedPod = card({
  id: 'maelia.seed-pod', name: 'Seed Pod', owner: 'maelia', generated: true, cost: 0, target: 'none', keywords: ['exhaust'],
  effects: [gainResource('embryo', 2)],
});

export const ripenedWomb = card({
  id: 'maelia.ripened-womb', name: 'Ripened Womb', owner: 'maelia', slot: 'transcend', cost: 3, target: 'none',
  keywords: ['exhaust'], charge: 35,
  effects: [gainResource('embryo', 3), createCard(seedPod), transcend()],
  text: 'Gain {effects.0.amount} Embryo. Create a Seed Pod in your hand. Transcend.',
});

// Card rewards (docs/notes/m4-run.md), offered after normal fights. Numbers are placeholders.

export const nursingBud = card({
  id: 'maelia.nursing-bud', name: 'Nursing Bud', owner: 'maelia', reward: true, cost: 1, target: 'none',
  effects: [gainResource('embryo', 2), chargeUltimate(10)],
  text: "Gain {effects.0.amount} Embryo. Charge its owner's ultimate by {effects.1.amount}.",
});

export const pollenDrift = card({
  id: 'maelia.pollen-drift', name: 'Pollen Drift', owner: 'maelia', reward: true, cost: 2, target: 'allEnemies',
  effects: [applyStatus(poison, mul(4, stat('attack')), 'allEnemies'), ifConsume('embryo', 2, [applyStatus(poison, mul(4, stat('attack')), 'allEnemies')])],
  text: 'Apply {effects.0.stacks} Poison to all enemies. Consume {effects.1.amount} Embryo: apply {effects.1.branch.0.stacks} more.',
});

// Potential, the lighter set (owner, 15 Nov; docs/notes/starter-kits.md, "Potential"): Shield and
// Poison instead of more Embryo. Numbers are placeholders.

// Midwife's Hands at P0 gives 1 more Embryo; at P1 also Shield; at P5 every Embryo consumed, by anyone,
// poisons every enemy.
const hands = (shield: boolean, poisons = false) => ({
  name: "Midwife's Hands", scope: 'combat' as const,
  text:
    (shield
      ? 'The first time each turn a card gains Embryo, gain {triggers.0.do.0.amount} more and {triggers.0.do.1.amount} Shield.'
      : 'The first time each turn a card gains Embryo, gain {triggers.0.do.0.amount} more.') +
    (poisons ? ' When Embryo is consumed, every enemy gains {triggers.1.do.0.stacks.mul.0} Poison for each.' : ''),
  triggers: [
    {
      on: 'resourceGained' as const, filter: { resource: 'embryo', direct: true as const }, once: 'turn' as const,
      do: [gainResource('embryo', 1), ...(shield ? [gainShield(stat('defense'))] : [])],
    },
    ...(poisons
      ? [{ on: 'resourceConsumed' as const, filter: { resource: 'embryo' }, do: [applyStatus(poison, mul(mul(0.34, stat('attack')), eventAmount()), 'allEnemies')] }]
      : []),
  ],
});

// Birthing Bloom; P4 heals and Shields half as much again (1.5 ×).
const BLOOM = 'Consume all Embryo. For each Embryo consumed, heal {effects.0.branch.0.amount.mul.0} and gain {effects.0.branch.1.amount.mul.0} Shield';
const bloom = (x: number) => {
  const mend = [heal(mul(percentOf(1.43 * x, 'maxHp'), consumed())), gainShield(mul(mul(0.8 * x, stat('defense')), consumed()))];
  return {
    name: 'Birthing Bloom',
    text: `${BLOOM}.`,
    effects: [ifConsume('embryo', resource('embryo'), mend)],
    transcended: {
      text: `${BLOOM}, and every enemy gains {effects.0.branch.2.stacks.mul.0} Poison.`,
      effects: [ifConsume('embryo', resource('embryo'), [...mend, applyStatus(poison, mul(mul(0.34, stat('attack')), consumed()), 'allEnemies')])],
    },
  };
};

// P3: Bud Cutting costs 2.
export const budCuttingP3 = variant(budCutting, 3, { cost: 2 });

const STATS = { hp: 55, attack: 9, defense: 15 };

export const maelia = character({
  id: 'maelia', name: 'Maelia', title: 'Midwife of the Bloom', domain: 'flesh',
  role: 'support',
  stats: STATS,
  cards: [strike, defense, ripenedWomb, swollenPod, budCutting],
  passive: hands(false),
  ultimate: bloom(1),
  dupes: [
    { text: "Midwife's Hands also gives Shield equal to her Defense.", passive: hands(true) },
    p2(STATS),
    { text: 'Bud Cutting costs 2.', cards: { [budCutting.id]: budCuttingP3.id } },
    { text: 'Birthing Bloom heals and Shields half as much again.', ultimate: bloom(1.5) },
    { text: 'When Embryo is consumed, every enemy gains Poison for each.', passive: hands(true, true) },
  ],
});
