import { describe, expect, it } from 'vitest';
import { apply, startCombat, type Command } from './combat.ts';
import type { CardDef, EnemyDef, Registry } from './defs.ts';
import { applyStatus, clearStatuses, damage, loseHp, summon, volley } from './ops/index.ts';
import { intentOf } from './phases.ts';
import { previewCard } from './preview.ts';
import type { CombatState } from './state.ts';
import { fixtureRegistry, STARTERS, testGain } from './testing/fixtures.ts';

// Enemies with several HP bars (DESIGN.md "Bosses"): a bar breaks, the rest of the hit is lost,
// the next bar comes up full, and the enemy takes no damage until its Rouse has acted.

const boss: EnemyDef = {
  id: 'test.boss', name: 'Boss', hp: 20,
  intents: [{ id: 'first', name: 'First', effects: [testGain('first')] }],
  phases: [
    {
      name: 'Second', hp: 30,
      rouse: { id: 'rouse', name: 'Rouse', effects: [clearStatuses()] },
      intents: [
        { id: 'a', name: 'A', effects: [testGain('a')] },
        { id: 'b', name: 'B', effects: [testGain('b')] },
      ],
    },
  ],
};
const caller: EnemyDef = {
  id: 'test.caller', name: 'Caller', hp: 20,
  phases: [{ name: 'Calling', hp: 20, rouse: { id: 'rouse', name: 'Rouse', effects: [] }, intents: [{ id: 'call', name: 'Call', effects: [summon({ id: 'test.frail' }, 1, 2)] }] }],
};
const card = (id: string, effects: CardDef['effects'], target: CardDef['target'] = 'chosenEnemy'): CardDef => ({ id, name: id, owner: 'test.a', cost: 0, target, effects });
const cards = [
  card('test.smash', [damage(25)]),
  card('test.poke', [damage(5)]),
  card('test.drain', [loseHp(5, { target: 'chosen' })]),
  card('test.mark', [applyStatus({ id: 'test.add' }, 2)]),
  card('test.volley', [volley(3, 15)], 'none'),
];
const registry: Registry = {
  ...fixtureRegistry,
  cards: { ...fixtureRegistry.cards, ...Object.fromEntries(cards.map((c) => [c.id, c])) },
  enemies: { ...fixtureRegistry.enemies, 'test.boss': boss, 'test.caller': caller },
};

const fight = (enemies = ['test.boss']) => startCombat({ seed: 1, party: STARTERS, enemies }, registry).state;
const BOSS = 'e20';

function play(state: CombatState, id: string, target: string | null = BOSS) {
  const next = structuredClone(state);
  const uid = `c${next.nextUid++}`;
  next.piles.hand.push({ uid, card: id, owner: 'm0' });
  const command: Command = { type: 'playCard', card: uid, ...(target !== null ? { target } : {}) };
  const result = apply(next, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return { ...result, preview: previewCard(next, command, registry) };
}
const endTurn = (state: CombatState) => {
  const result = apply(state, { type: 'endTurn' }, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
};
const bossOf = (state: CombatState) => state.enemies.find((e) => e.id === BOSS)!;

describe('HP bars', () => {
  it('a hit that empties a bar loses the rest, brings the next bar up full, and the enemy rouses', () => {
    const { state, events, vitals } = play(fight(), 'test.smash');
    expect(bossOf(state)).toMatchObject({ hp: 30, maxHp: 30, phase: 1, rousing: true });
    expect(events.map((e) => e.type)).toEqual(['cardPlayed', 'damageDealt', 'damageTaken', 'barBroken']);
    expect(events.at(-1)).toMatchObject({ source: 'm0', target: BOSS });
    expect(vitals.at(-1)!.enemies).toEqual([{ id: BOSS, hp: 30, shield: 0, phase: 1, maxHp: 30, rousing: true }]);
    expect([state.phase, state.outcome]).toEqual(['player', null]);
    expect(intentOf(bossOf(state), registry)?.name).toBe('Rouse');
  });

  it('a rousing enemy takes no damage or HP loss, and volleys pass it by; statuses still land', () => {
    const broken = play(fight(['test.boss', 'test.dummy']), 'test.smash').state;
    const poked = play(broken, 'test.poke');
    expect(poked.preview).toEqual([{ op: 'damage', target: BOSS, amount: 0, absorbed: 0 }]);
    expect(bossOf(poked.state).hp).toBe(30);
    expect(bossOf(play(broken, 'test.drain').state).hp).toBe(30);
    expect(play(broken, 'test.volley', null).state.enemies.map((e) => e.hp)).toEqual([30, 0]);
    expect(bossOf(play(broken, 'test.mark').state).statuses).toMatchObject([{ status: 'test.add', stacks: 2 }]);
  });

  it('a volley that breaks a bar loses the rest of that hit, and later hits pass the rousing enemy by', () => {
    // 15 on 20 HP leaves 5; the next 15 breaks the bar and its other 10 is lost; the third goes to the dummy.
    const { state, events } = play(fight(['test.boss', 'test.dummy']), 'test.volley', null);
    expect(state.enemies.map((e) => e.hp)).toEqual([30, 40 - 15]);
    expect(events.filter((e) => e.type === 'barBroken')).toHaveLength(1);
    // Alone, the Boss's broken bar never reads as a win.
    const alone = play(fight(), 'test.volley', null);
    expect([alone.state.outcome, bossOf(alone.state).hp]).toEqual([null, 30]);
    expect(alone.vitals.every((v) => v.enemies[0]!.hp > 0)).toBe(true);
  });

  it('the Rouse acts on its turn: it clears its statuses, then the new phase cycles its own intents', () => {
    const marked = play(play(fight(), 'test.smash').state, 'test.mark').state;
    const roused = endTurn(marked);
    expect(roused.events).toContainEqual(expect.objectContaining({ type: 'statusRemoved', target: BOSS, status: 'test.add' }));
    expect(bossOf(roused.state)).toMatchObject({ statuses: [], phase: 1, intent: 0 });
    expect(bossOf(roused.state).rousing).toBeUndefined();
    expect(intentOf(bossOf(roused.state), registry)?.name).toBe('A');
    expect(bossOf(play(roused.state, 'test.poke').state).hp).toBe(25);
    const next = endTurn(roused.state).state;
    expect([next.resources['a'], intentOf(bossOf(next), registry)?.name]).toEqual([1, 'B']);
  });

  it('emptying the last bar defeats the enemy', () => {
    const roused = endTurn(play(fight(), 'test.smash').state).state;
    const { state, events } = play(play(roused, 'test.smash').state, 'test.poke');
    expect(events.at(-1)).toEqual({ type: 'combatEnd', outcome: 'victory' });
    expect([state.phase, state.outcome, bossOf(state).hp]).toEqual(['ended', 'victory', 0]);
  });

  it("lays out slots for what any phase's intents can summon", () => {
    expect(fight(['test.caller']).enemySlots).toBe(3);
  });
});
