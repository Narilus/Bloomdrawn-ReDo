import { applyStatus, chargeUltimate, draw, gainMana, gainResource, gte, handCount, loseHp, percentOf, turn, when } from '../../engine/index.ts';
import { relic } from '../define.ts';
import { tentacleVolley } from '../domains/rapture.ts';
import { vulnerable } from '../statuses/vulnerable.ts';

// The first relics (docs/notes/m2-content.md). Run-scoped; they lean toward build direction.

export const brassThimble = relic({
  id: 'relic.brass-thimble', name: 'Brass Thimble', tier: 'common',
  text: '+1 Mana on the first turn of each combat.',
  triggers: [{ on: 'turnStart', do: [when(gte(1, turn()), [gainMana(1)])] }],
});

export const seedPacket = relic({
  id: 'relic.seed-packet', name: 'Seed Packet', tier: 'common',
  text: 'At combat start, gain 2 Embryo.',
  triggers: [{ on: 'combatStart', do: [gainResource('embryo', 2)] }],
});

export const crackedReliquary = relic({
  id: 'relic.cracked-reliquary', name: 'Cracked Reliquary', tier: 'uncommon',
  text: 'Strike and Defense charge 5 more ultimate.',
  triggers: [{ on: 'cardPlayed', filter: { slots: ['strike', 'defense'] }, do: [chargeUltimate(5, 'eventOwner')] }],
});

export const vigilWax = relic({
  id: 'relic.vigil-wax', name: 'Vigil Wax', tier: 'uncommon',
  text: 'At turn start, if a Ritual is in hand, draw 1 card.',
  triggers: [{ on: 'handDrawn', do: [when(gte(handCount('ritual'), 1), [draw(1)])] }],
});

export const midwifesShears = relic({
  id: 'relic.midwifes-shears', name: "Midwife's Shears", tier: 'rare',
  text: 'Whenever Embryo is consumed, apply 1 Vulnerable to all enemies.',
  triggers: [{ on: 'resourceConsumed', filter: { resource: 'embryo' }, do: [applyStatus(vulnerable, 1, 'allEnemies')] }],
});

export const choirBell = relic({
  id: 'relic.choir-bell', name: 'Choir Bell', tier: 'rare',
  text: 'At turn start, your Tentacles volley once, as well as at end of turn.',
  triggers: [{ on: 'turnStart', do: [tentacleVolley()] }],
});

export const bloomingCoin = relic({
  id: 'relic.blooming-coin', name: 'Blooming Coin', tier: 'cursed',
  // A share of max HP, so it keeps costing at depth (3 for the starters at level 1).
  text: '+1 Mana every turn. At turn start, the party loses 1.5% of its max HP.',
  triggers: [{ on: 'turnStart', do: [gainMana(1), loseHp(percentOf(1.5, 'maxHp'), { target: 'party' })] }],
});
