import { describe, expect, it } from 'vitest';
import { apply, cardCost, type Command } from './combat.ts';
import type { CardDef, Registry, RelicDef, StatusDef, TriggerDef } from './defs.ts';
import { add, formulaText, mul, playedThisTurn, resource, targetStacks } from './formula.ts';
import { applyStatus } from './ops/applyStatus.ts';
import { createCard, createCardOp } from './ops/createCard.ts';
import { damage } from './ops/damage.ts';
import { loseHp } from './ops/loseHp.ts';
import { repeat, repeatOp } from './ops/repeat.ts';
import { volley } from './ops/volley.ts';
import { previewCard } from './preview.ts';
import type { CombatState } from './state.ts';
import { fixtureCombat, fixtureRegistry, testGain, withCardInHand } from './testing/fixtures.ts';

// The engine pieces the banner kits need (docs/notes/banner-kits.md, "What these need in the
// engine"): trigger filters by status, keyword, card and party; a reaction on the event's target;
// the controlled event; a target's stacks; repeated effects; and extra volley passes for a turn.

const mark: StatusDef = { id: 'test.mark', stacking: 'add' };
const stun: StatusDef = { id: 'test.stun', stacking: 'highest', skipsAction: 'advance' };
const falter: StatusDef = { id: 'test.falter', stacking: 'highest', endsAfterAction: true };
const twice: StatusDef = { id: 'test.twice', stacking: 'highest', endsWithTurn: true, modifiers: [{ value: 'volleys', step: 'flat', amount: 1 }] };

const relic = (id: string, triggers: TriggerDef[]): RelicDef => ({ id, triggers });
const relics: RelicDef[] = [
  relic('test.on-mark', [{ on: 'statusApplied', filter: { status: 'test.mark', source: 'party' }, do: [testGain('marked')] }]),
  relic('test.on-ritual', [{ on: 'cardPlayed', filter: { keyword: 'ritual' }, do: [testGain('rituals')] }]),
  relic('test.on-card-volley', [{ on: 'volleyFired', filter: { fromCard: true }, do: [testGain('cardVolleys')] }]),
  relic('test.on-controlled', [{ on: 'controlled', do: [applyStatus(mark, 2, 'eventTarget')] }]),
  relic('test.end-volley', [{ on: 'turnEnd', do: [volley(resource('tentacles'), 1)] }]),
];

const card = (id: string, effects: CardDef['effects'], extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, owner: 'test.a', cost: 0, target: 'chosenEnemy', effects, ...extra,
});
const cards: CardDef[] = [
  card('test.mark', [applyStatus(mark, 3)]),
  card('test.ritual', [testGain('x')], { target: 'none', keywords: ['ritual'] }),
  card('test.volley', [volley(resource('tentacles'), 5)], { target: 'none' }),
  card('test.twice', [applyStatus(twice, 1, 'self')], { target: 'none' }),
  card('test.cuts', [repeat(3, [damage(4, { target: 'allEnemies' }), applyStatus(mark, 1, 'allEnemies')])], { target: 'none' }),
  card('test.open', [loseHp(mul(2, targetStacks(mark)), { target: 'chosen' })]),
  // A Strike that grows with the Strikes played before it, and leaves a free Fleeting copy of itself.
  card('test.combo', [damage(add(4, playedThisTurn('strike'))), createCard({ id: 'test.combo' }, { cost: 0, keywords: ['fleeting'] })], { cost: 1, slot: 'strike' }),
];

const registry: Registry = {
  ...fixtureRegistry,
  cards: { ...fixtureRegistry.cards, ...Object.fromEntries(cards.map((c) => [c.id, c])) },
  statuses: { ...fixtureRegistry.statuses, ...Object.fromEntries([mark, stun, falter, twice].map((s) => [s.id, s])) },
  relics: { ...fixtureRegistry.relics, ...Object.fromEntries(relics.map((r) => [r.id, r])) },
  enemies: {
    ...fixtureRegistry.enemies,
    'test.biter': { id: 'test.biter', name: 'Biter', hp: 40, intents: [{ id: 'bite', name: 'Bite', effects: [damage(5, { target: 'party' })] }] },
    // Marks its own bearer when hit by a status: an enemy's source, not the party's.
    'test.self-marker': { id: 'test.self-marker', name: 'Self-marker', hp: 40, intents: [{ id: 'mark', name: 'Mark', effects: [applyStatus(mark, 1, 'self')] }] },
  },
};

function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
const begin = (enemies: string[], with_: string[] = []) => fixtureCombat(enemies, with_, registry);
function play(state: CombatState, id: string, target?: string) {
  const [ready, c] = withCardInHand(state, id);
  return run(ready, target === undefined ? { type: 'playCard', card: c.uid } : { type: 'playCard', card: c.uid, target });
}

describe('trigger filters', () => {
  it('by status, from the party only', () => {
    const state = begin(['test.self-marker'], ['test.on-mark']);
    const played = play(state, 'test.mark', state.enemies[0]!.id);
    expect(played.state.resources['marked']).toBe(1);
    // The enemy marking itself in its turn is not the party applying it.
    const after = run(played.state, { type: 'endTurn' });
    expect(after.state.resources['marked']).toBe(1);
  });

  it('by the keyword of the card played', () => {
    const state = begin(['test.dummy'], ['test.on-ritual']);
    expect(play(state, 'test.ritual').state.resources['rituals']).toBe(1);
    expect(play(state, 'test.mark', state.enemies[0]!.id).state.resources['rituals']).toBeUndefined();
  });

  it("by a card's own volley, not one from a trigger", () => {
    const state = begin(['test.dummy'], ['test.on-card-volley', 'test.end-volley']);
    state.resources['tentacles'] = 1;
    const played = play(state, 'test.volley');
    expect(played.events.find((e) => e.type === 'volleyFired')?.card).toBeDefined();
    expect(played.state.resources['cardVolleys']).toBe(1);
    const ended = run(played.state, { type: 'endTurn' });
    expect(ended.events.filter((e) => e.type === 'volleyFired')).toHaveLength(1);
    expect(ended.state.resources['cardVolleys']).toBe(1);
  });
});

describe('the controlled event', () => {
  it('comes when control skips an action, and a reaction lands on that enemy', () => {
    const state = begin(['test.biter', 'test.biter'], ['test.on-controlled']);
    state.enemies[1]!.statuses.push({ status: 'test.stun', stacks: 1 });
    const after = run(state, { type: 'endTurn' });
    expect(after.events.filter((e) => e.type === 'controlled').map((e) => [e.target, e.status])).toEqual([[state.enemies[1]!.id, 'test.stun']]);
    expect(after.state.enemies.map((e) => e.statuses.find((s) => s.status === 'test.mark')?.stacks)).toEqual([undefined, 2]);
  });

  it('comes when an enemy acts weakened (Falter), after its action', () => {
    const state = begin(['test.biter'], ['test.on-controlled']);
    state.enemies[0]!.statuses.push({ status: 'test.falter', stacks: 1 });
    const after = run(state, { type: 'endTurn' });
    const types = after.events.map((e) => e.type);
    expect(types.indexOf('controlled')).toBeGreaterThan(types.indexOf('enemyActed'));
    expect(after.state.enemies[0]!.statuses).toEqual([{ status: 'test.mark', stacks: 2 }]);
  });
});

describe('a target’s stacks', () => {
  it('reads the chosen enemy’s statuses, and reads as "its"', () => {
    const state = begin(['test.dummy', 'test.dummy']);
    const [a, b] = state.enemies.map((e) => e.id) as [string, string];
    const marked = play(play(state, 'test.mark', a).state, 'test.mark', a).state;
    expect(play(marked, 'test.open', a).state.enemies[0]!.hp).toBe(40 - 12);
    expect(play(marked, 'test.open', b).state.enemies[1]!.hp).toBe(40);
    expect(formulaText(mul(2, targetStacks({ id: 'status.bleed' })))).toBe('2 × its Bleed');
  });
});

describe('repeat', () => {
  it('resolves its effects that many times, in order, and previews each pass', () => {
    const state = begin(['test.dummy', 'test.dummy']);
    const played = play(state, 'test.cuts');
    expect(played.state.enemies.map((e) => e.hp)).toEqual([28, 28]);
    expect(played.state.enemies.map((e) => e.statuses)).toEqual([[{ status: 'test.mark', stacks: 3 }], [{ status: 'test.mark', stacks: 3 }]]);
    const kinds = played.events.filter((e) => e.type === 'damageDealt' || e.type === 'statusApplied').map((e) => e.type);
    expect(kinds).toEqual(Array.from({ length: 3 }, () => ['damageDealt', 'damageDealt', 'statusApplied', 'statusApplied']).flat());
    const [ready, c] = withCardInHand(state, 'test.cuts');
    const preview = previewCard(ready, { type: 'playCard', card: c.uid }, registry);
    expect(preview?.[0]).toMatchObject({ op: 'repeat', amount: 3 });
    expect(preview?.[0]?.branch?.filter((p) => p.op === 'damage')).toHaveLength(6);
  });

  it('a pass whose target is dead fizzles', () => {
    const state = begin(['test.frail', 'test.dummy']);
    const played = play(state, 'test.cuts');
    expect(played.state.enemies.map((e) => e.hp)).toEqual([0, 28]);
  });

  it('describes itself', () => {
    expect(repeatOp.describe(repeat(5, [damage(3)]), formulaText, registry)).toBe('5 times: deal 3 damage');
  });
});

describe('extra volley passes for the turn', () => {
  it('every volley fires again, choosing targets from the HP the first pass left, and the status goes at end of turn', () => {
    const state = begin(['test.dummy', 'test.frail']);
    state.resources['tentacles'] = 2;
    const doubled = play(state, 'test.twice').state;
    const volleyed = play(doubled, 'test.volley');
    // Pass one: 5 kills the Frail, 5 hits the Dummy. Pass two: both hits on the Dummy.
    expect(volleyed.state.enemies.map((e) => e.hp)).toEqual([25, 0]);
    expect(volleyed.events.filter((e) => e.type === 'volleyFired')).toHaveLength(1);
    const ended = run(volleyed.state, { type: 'endTurn' });
    expect(ended.state.party.statuses).toEqual([]);
    expect(ended.events.some((e) => e.type === 'statusRemoved' && e.status === 'test.twice')).toBe(true);
  });
});

describe('Fleeting copies and Strikes played this turn', () => {
  it('a copy costs 0, counts the Strikes before it, and goes to the Graveyard when played', () => {
    const state = begin(['test.dummy']);
    const first = play(state, 'test.combo', state.enemies[0]!.id);
    expect(first.state.enemies[0]!.hp).toBe(40 - 4);
    const copy = first.state.piles.hand.find((c) => c.card === 'test.combo');
    expect(copy).toMatchObject({ cost: 0, keywords: ['fleeting'] });
    expect(cardCost(first.state, copy!, registry)).toBe(0);
    const second = run(first.state, { type: 'playCard', card: copy!.uid, target: state.enemies[0]!.id });
    expect(second.state.enemies[0]!.hp).toBe(40 - 4 - 5);
    expect(second.state.mana).toBe(first.state.mana);
    expect(second.state.piles.graveyard.map((c) => c.uid)).toEqual([copy!.uid]);
    expect(second.state.piles.discard.some((c) => c.uid === copy!.uid)).toBe(false);
    expect(second.events.some((e) => e.type === 'cardExhausted' && e.card === copy!.uid)).toBe(true);
  });

  it('an unplayed copy goes to the Graveyard at end of turn, and the count starts again next turn', () => {
    const state = begin(['test.dummy']);
    const first = play(state, 'test.combo', state.enemies[0]!.id);
    const copy = first.state.piles.hand.find((c) => c.card === 'test.combo')!;
    const ended = run(first.state, { type: 'endTurn' });
    expect(ended.state.piles.graveyard.map((c) => c.uid)).toEqual([copy.uid]);
    expect([...ended.state.piles.hand, ...ended.state.piles.draw, ...ended.state.piles.discard].some((c) => c.uid === copy.uid)).toBe(false);
    expect(ended.state.playedThisTurn).toEqual([]);
    const hp = ended.state.enemies[0]!.hp;
    expect(play(ended.state, 'test.combo', state.enemies[0]!.id).state.enemies[0]!.hp).toBe(hp - 4);
  });

  it('describes itself', () => {
    expect(createCardOp.describe(createCard({ id: 'test.combo' }, { cost: 0, keywords: ['fleeting'] }), formulaText, registry)).toBe(
      'Create a test.combo (costing 0, Fleeting) in your hand',
    );
    expect(formulaText(playedThisTurn('strike'))).toBe('Strikes played this turn');
  });
});
