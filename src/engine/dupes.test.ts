import { describe, expect, it } from 'vitest';
import { apply, startCombat, type Command } from './combat.ts';
import type { CardDef, CharacterDef, Registry, StatusDef } from './defs.ts';
import { characterOf, withDupes } from './dupes.ts';
import { add, stacks, stat } from './formula.ts';
import { applyStatus } from './ops/applyStatus.ts';
import { damage } from './ops/damage.ts';
import { loseHp } from './ops/loseHp.ts';
import { reduceStacks } from './ops/reduceStacks.ts';
import type { CombatState } from './state.ts';
import { describeCardLive, describeKit } from './text.ts';
import { fixtureRegistry, STARTERS, testGain, withCardInHand } from './testing/fixtures.ts';

// Dupe levels (DESIGN.md, "Character dupes"): each level replaces stats, the passive, the ultimate
// or a card from that level up, and combat reads a member at her level. Two modifier kinds serve the
// capstones: the stacks a status is applied with, and a party modifier acting on enemies' stack loss.

const mark: StatusDef = { id: 'test.mark', stacking: 'add' };
const other: StatusDef = { id: 'test.other', stacking: 'add' };
// Loses HP equal to its stacks at end of turn, then a stack, as Bleed does.
const wound: StatusDef = {
  id: 'test.wound', stacking: 'add',
  triggers: [{ on: 'statusTick', filter: { target: 'self' }, do: [loseHp(stacks('test.wound'), { status: 'test.wound' }), reduceStacks('test.wound')] }],
};

const card = (id: string, effects: CardDef['effects'], extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, owner: 'test.duped', cost: 0, target: 'chosenEnemy', effects, ...extra,
});
const cards: CardDef[] = [
  card('test.duped.hit', [damage(add(1, stat('attack')))], { slot: 'strike' }),
  card('test.duped.mark', [applyStatus(mark, 1), applyStatus(other, 1)], { slot: 'flavourA', text: 'Apply {effects.0.stacks} Mark and {effects.1.stacks} Other.' }),
  card('test.duped.mark-plus', [applyStatus(mark, 5)], { slot: 'flavourA', variantOf: 'test.duped.mark' }),
  card('test.duped.wound', [applyStatus(wound, 4)]),
];

const duped: CharacterDef = {
  id: 'test.duped', name: 'Duped', domain: 'test',
  stats: { hp: 20, attack: 3, defense: 2 },
  cards: ['test.duped.hit', 'test.duped.mark'],
  passive: { triggers: [{ on: 'turnEnd', do: [testGain('passive', 1)] }] },
  ultimate: { name: 'Ult', text: 'Gain.', effects: [testGain('ult', 1)], transcended: { text: 'Gain more.', effects: [testGain('ult', 2)] } },
  dupes: [
    { text: 'C1', passive: { text: 'Gain {triggers.0.do.0.amount}.', triggers: [{ on: 'turnEnd', do: [testGain('passive', 2)] }] } },
    { text: 'C2', stats: { hp: 22, attack: 4, defense: 3 } },
    { text: 'C3', cards: { 'test.duped.mark': 'test.duped.mark-plus' } },
    { text: 'C4', ultimate: { name: 'Ult', text: 'Gain lots.', effects: [testGain('ult', 10)], transcended: { text: 'Gain most.', effects: [testGain('ult', 20)] } } },
    {
      text: 'C5',
      passive: {
        triggers: [{ on: 'turnEnd', do: [testGain('passive', 2)] }],
        modifiers: [
          { value: 'stacks', step: 'flat', amount: 1, status: 'test.mark' },
          { value: 'stackLoss', step: 'outgoingMul', amount: 0, status: 'test.wound', on: 'enemies' },
        ],
      },
    },
  ],
};

const registry: Registry = {
  ...fixtureRegistry,
  cards: { ...fixtureRegistry.cards, ...Object.fromEntries(cards.map((c) => [c.id, c])) },
  characters: { ...fixtureRegistry.characters, [duped.id]: duped },
  statuses: { ...fixtureRegistry.statuses, ...Object.fromEntries([mark, other, wound].map((s) => [s.id, s])) },
};

const PARTY = ['test.duped', ...STARTERS.slice(1)];
const begin = (level: number) => startCombat({ seed: 1, party: PARTY, enemies: ['test.dummy'], dupes: [level] }, registry).state;
function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
/** Plays a fresh copy of a card from the member in slot 0 (or `owner`) at the first enemy. */
function play(state: CombatState, cardId: string, owner = 'm0') {
  const [next, instance] = withCardInHand(state, cardId, owner);
  return run(next, { type: 'playCard', card: instance.uid, target: next.enemies[0]!.id });
}
const statusesOf = (state: CombatState) => Object.fromEntries(state.enemies[0]!.statuses.map((s) => [s.status, s.stacks]));

describe('dupe levels', () => {
  it('apply in order from C1, each replacing what it sets, and C0 is the character as written', () => {
    expect(withDupes(duped, 0)).toBe(duped);
    expect(withDupes(duped, 1).passive?.triggers?.[0]?.do).toEqual([testGain('passive', 2)]);
    expect([withDupes(duped, 1).stats, withDupes(duped, 2).stats]).toEqual([duped.stats, { hp: 22, attack: 4, defense: 3 }]);
    expect([withDupes(duped, 2).cards, withDupes(duped, 3).cards]).toEqual([duped.cards, ['test.duped.hit', 'test.duped.mark-plus']]);
    // C5 restates the passive, so its own replaces C1's; C2's stats and C4's ultimate stay.
    expect(withDupes(duped, 5)).toMatchObject({ stats: { hp: 22 }, ultimate: { text: 'Gain lots.' }, passive: duped.dupes![4]!.passive });
  });

  it('a member keeps her level in combat state; at C0 there is none, so older states read the same', () => {
    expect(begin(0).members[0]).not.toHaveProperty('dupes');
    expect(begin(3).members[0]).toMatchObject({ character: 'test.duped', dupes: 3 });
    expect(characterOf(begin(3).members[0]!, registry)?.cards).toEqual(['test.duped.hit', 'test.duped.mark-plus']);
  });

  it('C2 stats set the party HP and her numbers; C3 deals the variant in place of the card', () => {
    const [c1, c2] = [begin(1), begin(2)];
    expect(c2.party.maxHp - c1.party.maxHp).toBe(2);
    expect(c1.enemies[0]!.hp - play(c1, 'test.duped.hit').enemies[0]!.hp).toBe(4);
    expect(c2.enemies[0]!.hp - play(c2, 'test.duped.hit').enemies[0]!.hp).toBe(5);
    const deck = (s: CombatState) => [...s.piles.draw, ...s.piles.hand].filter((c) => c.owner === 'm0').map((c) => c.card).sort();
    expect([deck(begin(2)), deck(begin(3))]).toEqual([
      ['test.duped.hit', 'test.duped.mark'],
      ['test.duped.hit', 'test.duped.mark-plus'],
    ]);
  });

  it('C1 changes what her passive does and says; C4 her ultimate, Transcended too', () => {
    const ended = (level: number) => run(begin(level), { type: 'endTurn' }).resources.passive;
    expect([ended(0), ended(1)]).toEqual([1, 2]);
    expect(describeKit(begin(1), 'm0', registry).passive).toBe('Gain 2.');
    const fired = (level: number, transcended = false) => {
      const state = structuredClone(begin(level));
      state.members[0]!.gauge = 100;
      if (transcended) state.members[0]!.transcended = true;
      return run(state, { type: 'fireUltimate', member: 'm0' }).resources.ult;
    };
    expect([fired(3), fired(4), fired(3, true), fired(4, true)]).toEqual([1, 10, 2, 20]);
  });
});

describe('the capstone modifiers', () => {
  it("`stacks` adds to one status applied by its holder, and her card's text shows it", () => {
    const [c4, c5] = [begin(4), begin(5)];
    expect(statusesOf(play(c4, 'test.duped.mark'))).toEqual({ 'test.mark': 1, 'test.other': 1 });
    expect(statusesOf(play(c5, 'test.duped.mark'))).toEqual({ 'test.mark': 2, 'test.other': 1 });
    // Another member's Mark is not hers.
    const theirs = { ...registry, cards: { ...registry.cards, 'test.b.mark': { ...cards[1]!, id: 'test.b.mark', owner: 'test.b' } } };
    const [next, instance] = withCardInHand(c5, 'test.b.mark', 'm1');
    const result = apply(next, { type: 'playCard', card: instance.uid, target: next.enemies[0]!.id }, theirs);
    expect(result.ok && statusesOf(result.state)).toEqual({ 'test.mark': 1, 'test.other': 1 });
    const [held, instance2] = withCardInHand(c5, 'test.duped.mark');
    expect(describeCardLive(instance2, held, registry)).toBe('Apply 2 Mark and 1 Other.');
  });

  it("a party modifier `on` enemies acts on their side: a wound on them ticks and keeps its stacks", () => {
    const ticked = (level: number) => run(play(begin(level), 'test.duped.wound'), { type: 'endTurn' }).enemies[0];
    expect(ticked(4)).toMatchObject({ hp: 36, statuses: [{ status: 'test.wound', stacks: 3 }] });
    expect(ticked(5)).toMatchObject({ hp: 36, statuses: [{ status: 'test.wound', stacks: 4 }] });
  });

  it("a modifier `on` enemies is not its holder's own: her damage is unchanged", () => {
    const zeroing = { ...duped, passive: { modifiers: [{ value: 'damage' as const, step: 'outgoingMul' as const, amount: 0, on: 'enemies' as const }] } };
    const reg = { ...registry, characters: { ...registry.characters, [duped.id]: zeroing } };
    const state = startCombat({ seed: 1, party: PARTY, enemies: ['test.dummy'] }, reg).state;
    const [next, instance] = withCardInHand(state, 'test.duped.hit');
    const result = apply(next, { type: 'playCard', card: instance.uid, target: next.enemies[0]!.id }, reg);
    expect(result.ok && result.state.enemies[0]!.hp).toBe(40 - 4);
  });
});
