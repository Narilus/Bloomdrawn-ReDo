import {
  add,
  applyStatus,
  createCard,
  damage,
  gainResource,
  gainShield,
  ifConsume,
  loseHp,
  mul,
  playedThisTurn,
  repeat,
  stat,
  targetStacks,
  transcend,
} from '../../engine/index.ts';
import { card, character } from '../define.ts';
import { bleed } from '../statuses/bleed.ts';

// Banner kit reviewed by the owner (docs/notes/banner-kits.md). Numbers are placeholders for tuning.
// Flesh tuning (owner, 27 Oct): Bleed stacks on her cards and Grafting Knife are three times their first numbers.

// Combo Bleed (owner, 27 Oct): each Strike played before it this turn, anyone's, adds 10%, and each Embryo
// spent leaves a free Fleeting copy to play next. Copies charge her ultimate like any Strike.
export const strike = card({
  id: 'virelle.strike', name: 'Strike', owner: 'virelle', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [
    damage(mul(add(6, stat('attack')), add(1, mul(0.1, playedThisTurn('strike'))))),
    ifConsume('embryo', 1, [applyStatus(bleed, 6), createCard({ id: 'virelle.strike' }, { cost: 0, keywords: ['fleeting'] })]),
  ],
  text: 'Deal {effects.0.amount} damage. Consume {effects.1.amount} Embryo: apply {effects.1.branch.0.stacks} Bleed and add a free Fleeting copy to your hand.',
});

export const defense = card({
  id: 'virelle.defense', name: 'Defense', owner: 'virelle', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(add(5, stat('defense')))],
});

export const sutureCut = card({
  id: 'virelle.suture-cut', name: 'Suture Cut', owner: 'virelle', slot: 'flavourA', cost: 2, target: 'chosenEnemy',
  effects: [damage(add(3, stat('attack'))), applyStatus(bleed, 9)],
  text: 'Deal {effects.0.amount} damage. Apply {effects.1.stacks} Bleed.',
});

// The detonation leaves the Bleed in place (owner, 25 Oct).
export const openTheWound = card({
  id: 'virelle.open-the-wound', name: 'Open the Wound', owner: 'virelle', slot: 'flavourB', cost: 2, target: 'chosenEnemy',
  effects: [damage(add(4, stat('attack'))), ifConsume('embryo', 2, [loseHp(mul(2, targetStacks(bleed)), { target: 'chosen' })])],
  text: 'Deal {effects.0.amount} damage. Consume {effects.1.amount} Embryo: the enemy loses HP equal to twice its Bleed.',
});

export const thornSpurBloom = card({
  id: 'virelle.thorn-spur-bloom', name: 'Thorn-Spur Bloom', owner: 'virelle', slot: 'transcend', cost: 3, target: 'allEnemies',
  keywords: ['exhaust'], charge: 35,
  effects: [applyStatus(bleed, 9, 'allEnemies'), gainResource('embryo', 2), transcend()],
  text: 'Apply {effects.0.stacks} Bleed to all enemies. Gain {effects.1.amount} Embryo. Transcend.',
});

// Card rewards (docs/notes/banner-kits.md). Numbers are placeholders.

export const bloodletting = card({
  id: 'virelle.bloodletting', name: 'Bloodletting', owner: 'virelle', reward: true, cost: 1, target: 'chosenEnemy',
  effects: [applyStatus(bleed, 12)],
});

export const thornSpur = card({
  id: 'virelle.thorn-spur', name: 'Thorn Spur', owner: 'virelle', reward: true, cost: 1, target: 'chosenEnemy',
  effects: [repeat(2, [damage(add(3, stat('attack')))])],
  text: 'Deal {effects.0.branch.0.amount} damage twice.',
});

const cuts = (times: number) => [repeat(times, [damage(add(3, stat('attack')), { target: 'allEnemies' }), applyStatus(bleed, 1, 'allEnemies')])];

export const virelle = character({
  id: 'virelle', name: 'Virelle', title: 'the Open Wound', domain: 'flesh',
  stats: { hp: 45, attack: 6, defense: 2 },
  cards: [strike, defense, thornSpurBloom, sutureCut, openTheWound],
  passive: {
    name: 'Opened Vein', scope: 'combat',
    // The 10% lives in her Strike's damage; the passive is where the owner placed it, so it's explained here.
    text: 'The first time each turn you apply Bleed, gain {triggers.0.do.0.amount} Embryo. Her Strike deals 10% more for each Strike played before it this turn.',
    triggers: [{ on: 'statusApplied', filter: { status: bleed.id, source: 'party' }, once: 'turn', do: [gainResource('embryo', 1)] }],
  },
  // Hits every enemy, for the wow of a rare ultimate (owner, 25 Oct).
  ultimate: {
    name: 'Thousand Cuts',
    text: 'Deal {effects.0.branch.0.amount} damage to all enemies {effects.0.times} times. Each hit applies {effects.0.branch.1.stacks} Bleed.',
    effects: cuts(5),
    transcended: {
      text: 'Deal {effects.0.branch.0.amount} damage to all enemies {effects.0.times} times. Each hit applies {effects.0.branch.1.stacks} Bleed.',
      effects: cuts(7),
    },
  },
});
