import { describe, expect, it } from 'vitest';
import { apply, startCombat } from './combat.ts';
import type { Registry } from './defs.ts';
import { enemyLevelScale } from './levels.ts';
import { damage } from './ops/damage.ts';
import { gainShield } from './ops/gainShield.ts';
import { heal } from './ops/heal.ts';
import { summon } from './ops/summon.ts';
import { applyStatus } from './ops/applyStatus.ts';
import { loseHp } from './ops/loseHp.ts';
import { stacks } from './formula.ts';
import { previewCard, previewIntent } from './preview.ts';
import { STARTERS, withCardInHand, withCards } from './testing/fixtures.ts';

// Enemy levels (M6.3; owner, 31 Oct: a depth fields enemies at its level): HP, Shield and heals
// follow the HP curve and damage the damage curve. Level 1 is today's enemy, and previews show the
// numbers that resolve.

const base = withCards({ id: 'test.strike', name: 'Strike', owner: 'test.a', cost: 1, target: 'chosenEnemy', effects: [damage(6)] });
const registry: Registry = {
  ...base,
  enemies: {
    ...base.enemies,
    'test.biter': {
      id: 'test.biter',
      name: 'Biter',
      hp: 400,
      intents: [
        { id: 'bite', name: 'Bite', effects: [damage(100, { target: 'party' })] },
      ],
    },
    'test.warden': {
      id: 'test.warden',
      name: 'Warden',
      hp: 400,
      intents: [
        { id: 'guard', name: 'Guard', effects: [gainShield(100)] },
        { id: 'mend', name: 'Mend', effects: [heal(100)] },
        { id: 'call', name: 'Call', effects: [summon({ id: 'test.dummy' }, 1, 1)] },
      ],
    },
    'test.blighter': {
      id: 'test.blighter',
      name: 'Blighter',
      hp: 400,
      intents: [{ id: 'blight', name: 'Blight', effects: [applyStatus({ id: 'test.rot' }, 10), applyStatus({ id: 'test.slow' }, 2)] }],
    },
    'test.barred': {
      id: 'test.barred',
      name: 'Barred',
      hp: 100,
      intents: [{ id: 'wait', name: 'Wait', effects: [] }],
      phases: [{ name: 'Second bar', hp: 200, rouse: { id: 'rouse', name: 'Rouse', effects: [] }, intents: [{ id: 'wait', name: 'Wait', effects: [] }] }],
    },
  },
};
registry.statuses = {
  ...registry.statuses,
  'test.rot': { id: 'test.rot', stacking: 'add', triggers: [{ on: 'statusTick', filter: { target: 'self' }, do: [loseHp(stacks('test.rot'))] }] },
  'test.slow': { id: 'test.slow', stacking: 'add', lasts: 'ownTurns' },
};
const start = (setup: { enemyLevel?: number; enemyScale?: number } = {}, enemies: Parameters<typeof startCombat>[0]['enemies'] = ['test.biter', { enemy: 'test.frail', hp: 10 }]) =>
  startCombat({ seed: 1, party: STARTERS, enemies, ...setup }, registry).state;
const endTurn = (state: ReturnType<typeof start>) => {
  const result = apply(state, { type: 'endTurn' }, registry);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
};

describe('enemy levels', () => {
  it('level 1 is 1,000 thousandths; HP grows 0.32% and damage 2.51% of level 1 a level to 40, then 3% of level 40 a level', () => {
    expect(enemyLevelScale()).toEqual({ hp: 1000, damage: 1000 });
    expect(enemyLevelScale(1)).toEqual({ hp: 1000, damage: 1000 });
    expect(enemyLevelScale(11)).toEqual({ hp: 1032, damage: 1251 });
    expect(enemyLevelScale(40)).toEqual({ hp: 1125, damage: 1979 });
    expect(enemyLevelScale(50)).toEqual({ hp: 1462, damage: 2573 });
  });

  it('a level 1 fight is the same state as one with no level, so the golden replay is unchanged', () => {
    expect(start({ enemyLevel: 1 })).toEqual(start());
    expect('enemyLevel' in start({ enemyLevel: 1 })).toBe(false);
  });

  it('raises max HP, encounter overrides included, rounding down, before the Bloom scale', () => {
    expect(start({ enemyLevel: 40 }).enemies.map((e) => [e.hp, e.maxHp])).toEqual([
      [450, 450],
      [11, 11],
    ]);
    // 400 at level 40 is 450; Seeded's +10% makes it 495.
    expect(start({ enemyLevel: 40, enemyScale: 10 }).enemies[0]!.maxHp).toBe(495);
  });

  it("raises an enemy's damage, and its intent preview shows what resolves", () => {
    const state = start({ enemyLevel: 40 });
    expect(previewIntent(state, state.enemies[0]!.id, registry).find((p) => p.op === 'damage')?.amount).toBe(197);
    expect(state.party.hp - endTurn(state).party.hp).toBe(Math.min(197, state.party.hp));
  });

  it("raises an enemy's Shield and heals by its HP curve", () => {
    const state = start({ enemyLevel: 40 }, ['test.warden']);
    expect(previewIntent(state, state.enemies[0]!.id, registry).find((p) => p.op === 'gainShield')?.amount).toBe(112);
    expect(endTurn(state).enemies[0]!.shield).toBe(112);
    const mending = endTurn(state);
    const hurt = { ...mending, enemies: mending.enemies.map((e) => ({ ...e, hp: 100 })) };
    expect(previewIntent(hurt, hurt.enemies[0]!.id, registry).find((p) => p.op === 'heal')?.amount).toBe(112);
  });

  it('the damage stacks an enemy applies follow its damage curve, and turn counts stay as written', () => {
    const state = start({ enemyLevel: 40 }, ['test.blighter']);
    const shown = previewIntent(state, state.enemies[0]!.id, registry).filter((p) => p.op === 'applyStatus');
    // 10 × 1.979 is 19.79: 19.
    expect(shown.map((p) => [p.status, p.amount])).toEqual([['test.rot', 19], ['test.slow', 2]]);
  });

  it("leaves the party's damage alone", () => {
    const [state, card] = withCardInHand(start({ enemyLevel: 40 }), 'test.strike');
    const command = { type: 'playCard', card: card.uid, target: state.enemies[0]!.id } as const;
    expect(previewCard(state, command, registry)?.find((p) => p.op === 'damage')?.amount).toBe(6);
  });

  it('a summoned enemy and a later HP bar come at the fight level', () => {
    const state = endTurn(endTurn(endTurn(start({ enemyLevel: 40 }, ['test.warden']))));
    expect(state.enemies.find((e) => e.enemy === 'test.dummy')?.maxHp).toBe(Math.floor((registry.enemies['test.dummy']!.hp * 1125) / 1000));
    const barred = start({ enemyLevel: 40 }, ['test.barred']);
    expect(barred.enemies[0]!.maxHp).toBe(112);
    const [ready, card] = withCardInHand({ ...barred, enemies: [{ ...barred.enemies[0]!, hp: 1 }] }, 'test.strike');
    const result = apply(ready, { type: 'playCard', card: card.uid, target: ready.enemies[0]!.id }, registry);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.enemies[0]!.maxHp).toBe(225);
  });
});
