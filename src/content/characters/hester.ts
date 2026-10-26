import { add, applyStatus, damage, draw, gainShield, stat, transcend } from '../../engine/index.ts';
import { card, character } from '../define.ts';
import { delay, stun } from '../statuses/control.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';

// Banner kit reviewed by the owner (docs/notes/banner-kits.md). Numbers are placeholders for tuning.
// Elites and bosses resist control, so on them Delay and Stun land as Falter, and her passive still pays.

export const strike = card({
  id: 'hester.strike', name: 'Strike', owner: 'hester', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(add(6, stat('attack')))],
});

export const defense = card({
  id: 'hester.defense', name: 'Defense', owner: 'hester', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(add(5, stat('defense')))],
});

export const weightedNet = card({
  id: 'hester.weighted-net', name: 'Weighted Net', owner: 'hester', slot: 'flavourA', cost: 2, target: 'chosenEnemy',
  effects: [applyStatus(delay, 1), applyStatus(weak, 1)],
  text: 'Apply Delay to an enemy. Apply {effects.1.stacks} Weak to it.',
});

export const boneWhistle = card({
  id: 'hester.bone-whistle', name: 'Bone Whistle', owner: 'hester', slot: 'flavourB', cost: 2, target: 'allEnemies',
  effects: [applyStatus(weak, 1, 'allEnemies'), applyStatus(vulnerable, 1, 'allEnemies'), draw(1)],
  text: 'Apply {effects.0.stacks} Weak and {effects.1.stacks} Vulnerable to all enemies. Draw {effects.2.count} card.',
});

export const ironHooks = card({
  id: 'hester.iron-hooks', name: 'Iron Hooks', owner: 'hester', slot: 'transcend', cost: 3, target: 'allEnemies',
  keywords: ['exhaust'], charge: 35,
  effects: [applyStatus(vulnerable, 2, 'allEnemies'), transcend()],
  text: 'Apply {effects.0.stacks} Vulnerable to all enemies. Transcend.',
});

// Card rewards (docs/notes/banner-kits.md). Numbers are placeholders.

export const pitfall = card({
  id: 'hester.pitfall', name: 'Pitfall', owner: 'hester', reward: true, cost: 1, target: 'chosenEnemy',
  effects: [applyStatus(vulnerable, 2)],
});

export const tangleLine = card({
  id: 'hester.tangle-line', name: 'Tangle Line', owner: 'hester', reward: true, cost: 1, target: 'allEnemies',
  effects: [gainShield(add(4, stat('defense'))), applyStatus(weak, 1, 'allEnemies')],
  text: 'Gain {effects.0.amount} Shield. Apply {effects.1.stacks} Weak to all enemies.',
});

export const hester = character({
  id: 'hester', name: 'Hester', title: 'the Snare-Warden', domain: 'unbound',
  stats: { hp: 55, attack: 4, defense: 4 },
  cards: [strike, defense, ironHooks, weightedNet, boneWhistle],
  passive: {
    name: "Hunter's Patience", scope: 'combat',
    text: 'When an enemy skips an action or Falters, it gains {triggers.0.do.0.stacks} Vulnerable.',
    triggers: [{ on: 'controlled', do: [applyStatus(vulnerable, 2, 'eventTarget')] }],
  },
  // Stun: the shown intent is lost; an enemy that retries does so in its own cycle (owner, 25 Oct).
  ultimate: {
    name: 'The Snare Closes',
    text: 'Stun every enemy: each loses its shown action, and its next is revealed.',
    effects: [applyStatus(stun, 1, 'allEnemies')],
    transcended: {
      text: 'Stun every enemy: each loses its shown action, and its next is revealed. Apply {effects.1.stacks} Weak to all enemies.',
      effects: [applyStatus(stun, 1, 'allEnemies'), applyStatus(weak, 2, 'allEnemies')],
    },
  },
});
