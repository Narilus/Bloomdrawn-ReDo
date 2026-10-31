import { applyStatus, damage, draw, gainShield, mul, stat, transcend } from '../../engine/index.ts';
import { c2, card, character, variant } from '../define.ts';
import { delay, stun } from '../statuses/control.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';

// Banner kit reviewed by the owner (docs/notes/banner-kits.md). Numbers are placeholders for tuning.
// Elites and bosses resist control, so on them Delay and Stun land as Falter, and her passive still pays.

export const strike = card({
  id: 'hester.strike', name: 'Strike', owner: 'hester', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(mul(2.5, stat('attack')))],
});

export const defense = card({
  id: 'hester.defense', name: 'Defense', owner: 'hester', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(mul(2.25, stat('defense')))],
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
  effects: [gainShield(mul(2, stat('defense'))), applyStatus(weak, 1, 'allEnemies')],
  text: 'Gain {effects.0.amount} Shield. Apply {effects.1.stacks} Weak to all enemies.',
});

// Hunter's Patience at C0 gives 2 Vulnerable, at C1 3; at C5 every Weak and Vulnerable she applies lasts a turn longer.
const huntersPatience = (stacks: number, capstone = false) => ({
  name: "Hunter's Patience", scope: 'combat' as const,
  text:
    'When an enemy skips an action or Falters, it gains {triggers.0.do.0.stacks} Vulnerable.' +
    (capstone ? ' The Weak and Vulnerable she applies last 1 turn longer.' : ''),
  triggers: [{ on: 'controlled' as const, do: [applyStatus(vulnerable, stacks, 'eventTarget')] }],
  ...(capstone && {
    modifiers: [weak, vulnerable].map((s) => ({ value: 'stacks' as const, step: 'flat' as const, amount: 1, status: s.id })),
  }),
});

const SNARE = 'Stun every enemy: each loses its shown action, and its next is revealed.';
// Stun: the shown intent is lost; an enemy that retries does so in its own cycle (owner, 25 Oct). C4 adds 2 Vulnerable to all enemies.
const snare = (vulnerableToo = false) => {
  const more = vulnerableToo ? [applyStatus(vulnerable, 2, 'allEnemies')] : [];
  const moreText = vulnerableToo ? ' Apply {effects.1.stacks} Vulnerable to all enemies.' : '';
  return {
    name: 'The Snare Closes',
    text: SNARE + moreText,
    effects: [applyStatus(stun, 1, 'allEnemies'), ...more],
    transcended: {
      text: `${SNARE}${moreText} Apply {effects.${more.length + 1}.stacks} Weak to all enemies.`,
      effects: [applyStatus(stun, 1, 'allEnemies'), ...more, applyStatus(weak, 2, 'allEnemies')],
    },
  };
};

// C3: Weighted Net costs 1 (docs/notes/banner-kits.md).
export const weightedNetC3 = variant(weightedNet, 3, { cost: 1 });

const STATS = { hp: 55, attack: 4, defense: 4 };

export const hester = character({
  id: 'hester', name: 'Hester', title: 'the Snare-Warden', domain: 'unbound',
  role: 'support',
  stats: STATS,
  cards: [strike, defense, ironHooks, weightedNet, boneWhistle],
  passive: huntersPatience(2),
  ultimate: snare(),
  dupes: [
    { text: "Hunter's Patience gives 3 Vulnerable.", passive: huntersPatience(3) },
    c2(STATS),
    { text: 'Weighted Net costs 1.', cards: { [weightedNet.id]: weightedNetC3.id } },
    { text: 'The Snare Closes also applies 2 Vulnerable to all enemies.', ultimate: snare(true) },
    { text: 'The Weak and Vulnerable she applies last 1 turn longer.', passive: huntersPatience(3, true) },
  ],
});
