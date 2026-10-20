import { describe, expect, it } from 'vitest';
import { apply, startCombat, type Command } from './combat.ts';
import type { EngineEvent } from './events.ts';
import { nextFloat } from './rng.ts';
import { HAND_DRAW, type CombatState } from './state.ts';
import { fixtureCombat, fixtureRegistry as registry, STARTERS, withCardInHand, withCards } from './testing/fixtures.ts';
import { volley } from './ops/volley.ts';

const start = (seed: number, extra: { enemies?: string[]; relics?: string[]; party?: string[] } = {}) =>
  startCombat(
    { seed, party: extra.party ?? STARTERS, enemies: extra.enemies ?? ['test.dummy'], relics: extra.relics ?? [] },
    registry,
  );

/** A fixed policy: play the first affordable card in hand, else end the turn. */
function nextCommand(state: CombatState): Command {
  for (const card of state.piles.hand) {
    const def = registry.cards[card.card];
    if (!def || def.cost > state.mana || card.card.endsWith('.fail')) continue;
    const target = def.target === 'chosenEnemy' ? state.enemies.find((e) => e.hp > 0)?.id : undefined;
    return target ? { type: 'playCard', card: card.uid, target } : { type: 'playCard', card: card.uid };
  }
  return { type: 'endTurn' };
}

function play(seed: number, steps: number) {
  const begin = start(seed);
  let state = begin.state;
  const events: EngineEvent[] = [...begin.events];
  const commands: Command[] = [];
  for (let i = 0; i < steps && state.phase === 'player'; i++) {
    const command = nextCommand(state);
    const result = apply(state, command, registry);
    if (!result.ok) throw new Error(result.reason);
    commands.push(command);
    events.push(...result.events);
    state = result.state;
  }
  return { state, events, commands };
}

describe('combat start', () => {
  it('builds a 20-card deck, refills Mana and draws to 5', () => {
    const { state, events } = start(1);
    expect(state.turn).toBe(1);
    expect(state.mana).toBe(6);
    expect(state.piles.hand).toHaveLength(HAND_DRAW);
    expect(state.piles.draw).toHaveLength(15);
    expect(state.party).toEqual({ hp: 80, maxHp: 80, shield: 0, statuses: [] });
    expect(events.map((e) => e.type).slice(0, 2)).toEqual(['combatStart', 'turnStart']);
    expect(events.filter((e) => e.type === 'cardDrawn')).toHaveLength(5);
  });

  it('state is plain JSON', () => {
    const { state } = play(3, 12);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('determinism', () => {
  it('the same seed and commands give identical events and state', () => {
    const a = play(1234, 40);
    const b = play(1234, 40);
    expect(a.commands.length).toBeGreaterThan(5);
    expect(b.events).toEqual(a.events);
    expect(b.state).toEqual(a.state);
  });

  it('a different seed changes the shuffle', () => {
    expect(start(1).state.piles.hand).not.toEqual(start(2).state.piles.hand);
  });

  it('drawing from the targeting stream never shifts the shuffle', () => {
    const quiet = start(77).state;
    const busy = structuredClone(quiet);
    for (let i = 0; i < 25; i++) nextFloat(busy.rng, 'targeting');

    let a = quiet;
    let b = busy;
    for (let turn = 0; turn < 6; turn++) {
      const ra = apply(a, { type: 'endTurn' }, registry);
      const rb = apply(b, { type: 'endTurn' }, registry);
      if (!ra.ok || !rb.ok) throw new Error('endTurn rejected');
      a = ra.state;
      b = rb.state;
      expect(b.piles.hand).toEqual(a.piles.hand);
    }
    expect(b.rng.shuffle).toBe(a.rng.shuffle);
    expect(b.rng.targeting).not.toBe(a.rng.targeting);
  });
});

describe('rejected commands', () => {
  const cases: [string, (s: CombatState) => [CombatState, Command]][] = [
    ['card not in hand', (s) => [s, { type: 'playCard', card: 'c999' }]],
    ['not enough Mana', (s) => withPlay(s, 'test.a.pricey')],
    ['missing target', (s) => withPlay(s, 'test.a.hit')],
    ['target on an untargeted card', (s) => withPlay(s, 'test.a.gain', 'e20')],
    ['an operation that cannot resolve', (s) => withPlay(s, 'test.a.fail')],
    ['dead target', (s) => {
      const [next, cmd] = withPlay(s, 'test.a.hit', 'e20');
      (next.enemies[0] as { hp: number }).hp = 0;
      next.enemies.push({ id: 'e99', enemy: 'test.dummy', slot: 1, hp: 10, maxHp: 10, shield: 0, statuses: [] });
      return [next, cmd];
    }],
    ['wrong phase', (s) => [{ ...structuredClone(s), phase: 'enemy' }, { type: 'endTurn' }]],
  ];

  function withPlay(s: CombatState, card: string, target?: string): [CombatState, Command] {
    const [next, instance] = withCardInHand(s, card);
    const command: Command = { type: 'playCard', card: instance.uid };
    if (target !== undefined) command.target = target;
    return [next, command];
  }

  it.each(cases)('%s leaves state deeply equal', (_name, make) => {
    const [state, command] = make(start(5).state);
    const before = structuredClone(state);
    const result = apply(state, command, registry);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(state).toEqual(before);
  });
});

describe('playing a card', () => {
  it('spends Mana, resolves its operations and goes to the discard pile', () => {
    const [state, card] = withCardInHand(start(9).state, 'test.b.hit', 'm1');
    const result = apply(state, { type: 'playCard', card: card.uid, target: 'e20' }, registry);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.mana).toBe(5);
    expect(result.state.enemies[0]?.hp).toBe(34);
    expect(result.state.piles.discard.map((c) => c.uid)).toContain(card.uid);
    expect(result.events.map((e) => e.type)).toEqual(['cardPlayed', 'damageDealt']);
    expect(result.events[0]).toMatchObject({ source: 'm1', owner: 'm1', target: 'e20' });
  });

  it('stops resolution at victory', () => {
    const [state, card] = withCardInHand(start(9, { enemies: ['test.frail'] }).state, 'test.a.big');
    const result = apply(state, { type: 'playCard', card: card.uid, target: 'e20' }, registry);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.phase).toBe('ended');
    expect(result.state.outcome).toBe('victory');
    expect(result.events.map((e) => e.type)).toEqual(['cardPlayed', 'damageDealt', 'combatEnd']);
    expect(apply(result.state, { type: 'endTurn' }, registry).ok).toBe(false);
  });
});

describe('vitals', () => {
  it('record HP and Shield right after each event, ending at the final state', () => {
    const [state, card] = withCardInHand(start(9).state, 'test.b.hit', 'm1');
    const result = apply(state, { type: 'playCard', card: card.uid, target: 'e20' }, registry);
    if (!result.ok) throw new Error(result.reason);
    expect(result.vitals).toHaveLength(result.events.length);
    // Before the hit lands (cardPlayed) the dummy is whole; after damageDealt it has lost 6.
    expect(result.vitals.map((v) => v.enemies[0]?.hp)).toEqual([40, 34]);
    const last = result.vitals.at(-1);
    expect(last?.party).toEqual({ hp: result.state.party.hp, shield: result.state.party.shield });
  });

  it('follow each hit of a volley, and a fight won partway through one ends on the killing hit with every death recorded', () => {
    // One hit of 12 kills the first 5 HP enemy and carries 7 into the second.
    const sweep = { id: 'test.sweep', name: 'Sweep', owner: 'test.a', cost: 0, target: 'none' as const, effects: [volley(1, 12)] };
    const reg = withCards(sweep);
    const [state, card] = withCardInHand(fixtureCombat(['test.frail', 'test.frail'], [], reg), 'test.sweep');
    const result = apply(state, { type: 'playCard', card: card.uid }, reg);
    if (!result.ok) throw new Error(result.reason);
    const hits = result.events.flatMap((e, i) => (e.type === 'cardPlayed' ? [] : [[e.type, e.target, result.vitals[i]!.enemies.map((v) => v.hp)]]));
    expect(hits).toEqual([
      ['damageDealt', 'e20', [0, 5]],
      ['damageTaken', 'e20', [0, 5]],
      ['enemyDefeated', 'e20', [0, 5]],
      ['damageDealt', 'e21', [0, 0]],
      ['combatEnd', undefined, [0, 0]],
    ]);
  });
});
