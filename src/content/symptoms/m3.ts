import { applyStatus, chargeUltimate, damage, draw, drawFewer, gainMana, loseHp, mul, percentOf, stat } from '../../engine/index.ts';
import { card } from '../define.ts';
import { poison } from '../statuses/poison.ts';
import { weak } from '../statuses/weak.ts';

// Symptoms (docs/notes/m3-labyrinth.md): the party's own cards, each with a real benefit and a real
// cost. They stay for the run and the front member plays them. HP costs are a share of HP, so they
// keep mattering to a levelled team (owner, 19 Oct). Numbers are placeholders for tuning.

export const feveredPulse = card({
  id: 'symptom.fevered-pulse', name: 'Fevered Pulse', cost: 0, target: 'none', keywords: ['exhaust'],
  effects: [gainMana(2), loseHp(percentOf(4, 'hp'), { target: 'party' })],
  text: 'Gain {effects.0.amount} Mana. The party loses {effects.1.amount} HP ({effects.1.amount.percent}% of current).',
});

export const sweetRot = card({
  id: 'symptom.sweet-rot', name: 'Sweet Rot', cost: 1, target: 'chosenEnemy',
  // The front member plays it: 350% of her Attack, 14 for Agathe at the front at level 1.
  effects: [damage(mul(3.5, stat('attack'))), applyStatus(poison, percentOf(1, 'maxHp'), 'allEnemies'), applyStatus(poison, percentOf(1, 'maxHp'), 'self')],
  text: "Deal {effects.0.amount} damage. Every enemy and the party gain {effects.1.stacks} Poison ({effects.1.stacks.percent}% of the party's max HP).",
});

export const graftedHand = card({
  id: 'symptom.grafted-hand', name: 'Grafted Hand', cost: 0, target: 'none',
  effects: [draw(2), drawFewer(1)],
});

export const pollenLung = card({
  id: 'symptom.pollen-lung', name: 'Pollen Lung', cost: 1, target: 'none',
  effects: [chargeUltimate(15, 'party'), applyStatus(weak, 1, 'self')],
  text: 'Every party member gains {effects.0.amount} ultimate charge. The party gains {effects.1.stacks} Weak.',
});
