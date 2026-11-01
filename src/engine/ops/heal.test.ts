import { describe, expect, it } from 'vitest';
import type { Registry } from '../defs.ts';
import { formulaText } from '../formula.ts';
import { fixtureCombat, fixtureRegistry as registry } from '../testing/fixtures.ts';
import { heal, healOp } from './heal.ts';
import { summon } from './summon.ts';

describe('heal', () => {
  it("heals the source's side, never past max HP, and preview matches", () => {
    const state = fixtureCombat();
    state.party.hp = 70;
    expect(healOp.preview(state, heal(15), { source: 'm1' }, registry)).toEqual([{ op: 'heal', target: 'party', amount: 10 }]);
    const { events } = healOp.resolve(state, heal(15), { source: 'm1', owner: 'm1' }, registry);
    expect(state.party.hp).toBe(80);
    expect(events).toEqual([{ type: 'healed', source: 'm1', owner: 'm1', target: 'party', amount: 10 }]);
    const enemy = state.enemies[0]!;
    enemy.hp = 30;
    healOp.resolve(state, heal(4), { source: enemy.id }, registry);
    expect(enemy.hp).toBe(34);
  });

  describe('a hurt leader first, then the most hurt ally, then itself (Suture)', () => {
    const withLeaders: Registry = {
      ...registry,
      enemies: {
        ...registry.enemies,
        'test.big': { id: 'test.big', name: 'Big', hp: 100 },
        'test.boss': { id: 'test.boss', name: 'Boss', hp: 100, phases: [{ name: 'Second', hp: 100, rouse: { id: 'r', name: 'R', effects: [] }, intents: [{ id: 'a', name: 'A', effects: [] }] }] },
        'test.caller': { id: 'test.caller', name: 'Caller', hp: 100, intents: [{ id: 'call', name: 'Call', effects: [summon({ id: 'test.frail' }, 1, 1)] }] },
      },
    };
    /** The slot `heal(10, 'leaderFirst')` from the enemy in slot 0 would heal, with every enemy at the HP given. */
    const healsSlot = (enemies: string[], hp: number[]) => {
      const state = fixtureCombat(enemies, [], withLeaders);
      state.enemies.forEach((e, i) => (e.hp = hp[i]!));
      const [preview] = healOp.preview(state, heal(10, 'leaderFirst'), { source: state.enemies[0]!.id }, withLeaders);
      return state.enemies.find((e) => e.id === preview?.target)?.slot;
    };

    it('a hurt Boss or summoner comes first, even when another ally is more hurt', () => {
      expect(healsSlot(['test.dummy', 'test.dummy', 'test.boss'], [40, 10, 99])).toBe(2);
      expect(healsSlot(['test.dummy', 'test.dummy', 'test.caller'], [40, 10, 99])).toBe(2);
    });

    it('with no hurt leader, the ally missing the largest share of its HP, not the lowest HP', () => {
      // The dummy has the lower HP (30 of 40), but Big misses more of its own (40 of 100).
      expect(healsSlot(['test.dummy', 'test.dummy', 'test.big'], [40, 30, 60])).toBe(2);
      expect(healsSlot(['test.dummy', 'test.dummy', 'test.big'], [40, 30, 90])).toBe(1);
      // An unhurt leader is passed over.
      expect(healsSlot(['test.dummy', 'test.dummy', 'test.boss'], [40, 30, 100])).toBe(1);
      // Equal shares: the earlier slot.
      expect(healsSlot(['test.dummy', 'test.dummy', 'test.dummy'], [40, 20, 20])).toBe(1);
    });

    it('itself last: only when no other ally is hurt, however hurt it is', () => {
      expect(healsSlot(['test.dummy', 'test.dummy'], [10, 39])).toBe(1);
      expect(healsSlot(['test.dummy', 'test.boss'], [10, 100])).toBe(0);
    });
  });

  it('describes itself', () => {
    expect(healOp.describe(heal(3), formulaText, registry)).toBe('Heal 3');
  });
});
