import { describe, expect, it } from 'vitest';
import {
  apply,
  applyStatus,
  damage,
  intentOf,
  mul,
  previewIntent,
  stat,
  startCombat,
  type CardDef,
  type CombatState,
  type Command,
  type Registry,
} from '../../engine/index.ts';
import { registry as gameRegistry } from '../registry.ts';
import { STARTER_PARTY } from '../testing/scenario.ts';

// Band 3, the Lost Expedition (docs/notes/bestiary.md), at level 1. The party only ends turns,
// healed between them where the enemies would kill it.

const card = (id: string, effects: CardDef['effects']): CardDef => ({ id, name: id, owner: 'leonora', cost: 0, target: 'chosenEnemy', effects });
const testCards = [
  card('test.cut', [damage(mul(10, stat('attack')))]),
  card('test.rot', [applyStatus({ id: 'status.poison' }, 20), applyStatus({ id: 'status.bleed' }, 10)]),
];
const registry: Registry = { ...gameRegistry, cards: { ...gameRegistry.cards, ...Object.fromEntries(testCards.map((c) => [c.id, c])) } };

const begin = (enemies: string[]) => startCombat({ seed: 6, party: STARTER_PARTY, enemies }, registry).state;
function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
/** Ends `n` turns, with the party at full HP and free of statuses before each, so every number reads at its base. */
const turns = (state: CombatState, n: number) =>
  Array.from({ length: n }).reduce<CombatState>((s) => run({ ...s, party: { ...s.party, hp: s.party.maxHp, statuses: [] } }, { type: 'endTurn' }).state, state);
/** Each enemy's intent as its name and previewed effects (`op status amount`, `on itself` where it lands on itself). */
const shown = (state: CombatState, index = 0) => {
  const enemy = state.enemies[index]!;
  const effects = previewIntent(state, enemy.id, registry).map((p) => `${p.op}${p.status ? ` ${p.status}` : ''} ${p.amount}${p.target === enemy.id ? ' on itself' : ''}`);
  return [intentOf(enemy, registry)?.name, effects];
};
function cycle(state: CombatState, n: number, index = 0) {
  const seen: ReturnType<typeof shown>[] = [];
  let s = state;
  for (let i = 0; i < n; i++) {
    seen.push(shown(s, index));
    s = turns(s, 1);
  }
  return seen;
}
function play(state: CombatState, id: string, target = 0) {
  const next = structuredClone(state);
  const uid = `c${next.nextUid++}`;
  next.piles.hand.push({ uid, card: id, owner: 'm3' });
  return run(next, { type: 'playCard', card: uid, target: next.enemies[target]!.id });
}
const hp = (state: CombatState, index = 0) => state.enemies[index]!.hp;

describe('The Cocooned Scout (elite: timing)', () => {
  it('Cocoon, Unfurl 70 and Vulnerable on itself, Wing Cut 45, Moth Dust 2 Weak, then again; resists control', () => {
    expect(cycle(begin(['enemy.cocooned-scout']), 5)).toEqual([
      ['Cocoon', ['applyStatus status.cocooned 1 on itself']],
      ['Unfurl', ['damage 70', 'applyStatus status.vulnerable 1 on itself']],
      ['Wing Cut', ['damage 45']],
      ['Moth Dust', ['applyStatus status.weak 2']],
      ['Cocoon', ['applyStatus status.cocooned 1 on itself']],
    ]);
    expect(registry.enemies['enemy.cocooned-scout']?.traits).toContain('resistsControl');
  });

  it('cocooned, card damage does nothing until it Unfurls, and only that one turn in four', () => {
    const start = begin(['enemy.cocooned-scout']);
    /** What the same cut deals after `n` turns, the party free of statuses (Moth Dust's Weak). */
    const cutAfter = (n: number) => {
      const s = turns(start, n);
      const clear = { ...s, party: { ...s.party, statuses: [] } };
      return hp(clear) - hp(play(clear, 'test.cut').state);
    };
    const dealt = cutAfter(0);
    expect(dealt).toBeGreaterThan(0);
    // Cocooned; then Vulnerable after Unfurl, half as much again; then open until the next Cocoon.
    expect([1, 2, 3, 4].map(cutAfter)).toEqual([0, Math.floor(dealt * 1.5), dealt, dealt]);
    expect(cutAfter(5)).toBe(0);
  });

  it('cocooned, statuses still land, and Poison and Bleed still tick', () => {
    const rotted = play(turns(begin(['enemy.cocooned-scout']), 1), 'test.rot').state;
    expect(rotted.enemies[0]!.statuses.map((s) => s.status)).toEqual(['status.cocooned', 'status.poison', 'status.bleed']);
    expect(hp(rotted) - hp(turns(rotted, 1))).toBe(30);
  });

  it("cocooned, Rapture's volley passes it by for the next enemy", () => {
    // The Wolf has more HP, so the volley would take the Scout first.
    const closed = turns(begin(['enemy.cocooned-scout', 'enemy.three-throated-wolf']), 1);
    const armed = { ...closed, resources: { ...closed.resources, tentacles: 3 } };
    const after = turns(armed, 1);
    expect(hp(after)).toBe(hp(closed));
    expect(hp(after, 1)).toBeLessThan(hp(closed, 1));
  });
});
