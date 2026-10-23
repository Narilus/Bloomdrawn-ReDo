import { describe, expect, it } from 'vitest';
import {
  apply,
  applyStatus,
  damage,
  intentOf,
  isAlive,
  previewIntent,
  startCombat,
  type CardDef,
  type CombatState,
  type Command,
  type Registry,
} from '../../engine/index.ts';
import { registry as gameRegistry } from '../registry.ts';
import { STARTER_PARTY } from '../testing/scenario.ts';

// The M4 Boss (docs/notes/m4-run.md): the Hollow Abbess, two bars of 200. The party mostly ends
// turns here, so changes come from her (and Agathe's 3-damage First Hymn Tentacle at each end of turn).

const cards: CardDef[] = [
  { id: 'test.break', name: 'Break', owner: 'leonora', cost: 0, target: 'chosenEnemy', effects: [damage(300)] },
  { id: 'test.expose', name: 'Expose', owner: 'leonora', cost: 0, target: 'chosenEnemy', effects: [applyStatus({ id: 'status.vulnerable' }, 2)] },
  { id: 'test.stun', name: 'Stun', owner: 'leonora', cost: 0, target: 'chosenEnemy', effects: [applyStatus({ id: 'status.stun' }, 1)] },
];
const registry: Registry = { ...gameRegistry, cards: { ...gameRegistry.cards, ...Object.fromEntries(cards.map((c) => [c.id, c])) } };

const begin = (encounter: string) => startCombat({ seed: 6, party: STARTER_PARTY, enemies: registry.encounters[encounter]!.enemies }, registry).state;
function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
const turns = (state: CombatState, n: number) => Array.from({ length: n }).reduce<CombatState>((s) => run(s, { type: 'endTurn' }).state, state);
function play(state: CombatState, card: string) {
  const next = structuredClone(state);
  const uid = `c${next.nextUid++}`;
  next.piles.hand.push({ uid, card, owner: 'm3' });
  return run(next, { type: 'playCard', card: uid, target: next.enemies[0]!.id });
}
const abbess = (state: CombatState) => state.enemies[0]!;
const intent = (state: CombatState) => intentOf(abbess(state), registry)?.name;
/** Her intent's previewed effects, as `op amount` (damage to the party, statuses, summons). */
const shown = (state: CombatState) => previewIntent(state, abbess(state).id, registry).map((p) => `${p.op}${p.status ? ` ${p.status}` : ''} ${p.amount}`);

describe('The Hollow Abbess, Sermon', () => {
  it('a huge anchor with room for two Acolytes in the side lanes; resists control', () => {
    const start = begin('encounter.hollow-abbess');
    expect([start.enemySlots, abbess(start).slot, abbess(start).maxHp, abbess(start).phase]).toEqual([3, 0, 200, 0]);
    expect(registry.enemies['enemy.hollow-abbess']?.size).toBe('huge');
    expect(abbess(play(start, 'test.stun').state).statuses.map((s) => s.status)).toEqual(['status.falter']);
  });

  it('Censer Sermon gives the party 2 Weak, Crozier Blow deals 16, Call the Faithful brings an Acolyte to a side lane', () => {
    const start = begin('encounter.hollow-abbess');
    expect([intent(start), shown(start)]).toEqual(['Censer Sermon', ['applyStatus status.weak 2']]);
    const one = turns(start, 1);
    expect(one.party.statuses).toEqual([{ status: 'status.weak', stacks: 2 }]);
    expect([intent(one), shown(one)]).toEqual(['Crozier Blow', ['damage 16']]);
    const two = turns(one, 1);
    expect(two.party.hp).toBe(210 - 16);
    expect(intent(two)).toBe('Call the Faithful');
    const three = turns(two, 1);
    expect(three.enemies.filter(isAlive).map((e) => [e.enemy, e.slot])).toEqual([
      ['enemy.hollow-abbess', 0],
      ['enemy.censer-acolyte', 1],
    ]);
    expect(intent(three)).toBe('Censer Sermon');
  });
});

describe('The Hollow Abbess, her second bar', () => {
  it('a hit that empties her first bar brings up the second at 200; she takes nothing until Taking Root', () => {
    const exposed = play(play(begin('encounter.hollow-abbess'), 'test.break').state, 'test.expose').state;
    expect(abbess(exposed)).toMatchObject({ hp: 200, maxHp: 200, phase: 1, rousing: true });
    expect([intent(exposed), shown(exposed)]).toEqual(['Taking Root', ['clearStatuses 1']]);
    // Agathe's Tentacle passes her by at the end of the turn, and her Rouse clears the Vulnerable.
    const rooted = turns(exposed, 1);
    expect(abbess(rooted)).toMatchObject({ hp: 200, statuses: [] });
    expect(abbess(rooted).rousing).toBeUndefined();
    expect(rooted.party.hp).toBe(210);
  });

  it('Rooted: Root Lash deals 8 twice, Grasping Roots gives 2 Vulnerable, Bloom Burst deals 28', () => {
    const rooted = turns(play(begin('encounter.hollow-abbess'), 'test.break').state, 1);
    expect([intent(rooted), shown(rooted)]).toEqual(['Root Lash', ['damage 8', 'damage 8']]);
    const lashed = turns(rooted, 1);
    expect(lashed.party.hp).toBe(210 - 16);
    expect([intent(lashed), shown(lashed)]).toEqual(['Grasping Roots', ['applyStatus status.vulnerable 2']]);
    const gripped = turns(lashed, 1);
    expect(gripped.party.statuses).toEqual([{ status: 'status.vulnerable', stacks: 2 }]);
    // Bloom Burst is 28; the party's Vulnerable makes it 42.
    expect([intent(gripped), shown(gripped)]).toEqual(['Bloom Burst', ['damage 42']]);
    expect(intent(turns(gripped, 1))).toBe('Root Lash');
  });

  it('at Fruiting she is Full Bloom: Blossoming, then Root Lash three times, Pollen Choir, Call the Faithful and Bloom Burst 32', () => {
    const start = begin('encounter.hollow-abbess-full-bloom');
    expect([intent(start), abbess(start).maxHp]).toEqual(['Censer Sermon', 200]);
    const broken = play(start, 'test.break').state;
    expect(intent(broken)).toBe('Blossoming');
    let state = turns(broken, 1);
    const seen: [string | undefined, string[]][] = [];
    for (let i = 0; i < 4; i++) {
      seen.push([intent(state), shown(state)]);
      // Clear the party's statuses each turn so every number reads at its base.
      const next = turns(state, 1);
      state = { ...next, party: { ...next.party, statuses: [], hp: 210 } };
    }
    expect(seen).toEqual([
      ['Root Lash', ['damage 8', 'damage 8', 'damage 8']],
      ['Pollen Choir', ['applyStatus status.weak 2', 'applyStatus status.vulnerable 2']],
      ['Call the Faithful', ['summon 1']],
      ['Bloom Burst', ['damage 32']],
    ]);
  });

  it('emptying her second bar wins the fight', () => {
    const rooted = turns(play(begin('encounter.hollow-abbess'), 'test.break').state, 1);
    const { state } = play(rooted, 'test.break');
    expect([state.outcome, abbess(state).hp]).toEqual(['victory', 0]);
  });
});
