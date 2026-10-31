import { describe, expect, it } from 'vitest';
import {
  apply,
  damage,
  intentOf,
  isAlive,
  mul,
  previewIntent,
  stat,
  startCombat,
  type CardDef,
  type CombatState,
  type Command,
  type EnemyEntry,
  type Registry,
} from '../../engine/index.ts';
import { registry as gameRegistry } from '../registry.ts';
import { STARTER_PARTY } from '../testing/scenario.ts';

// Band 2, the Thicket (docs/notes/bestiary.md), at level 1. The party only ends turns, healed
// between them where the enemies would kill it. Fights with summons or small enemies use a party
// without Rapture, so no Tentacle cuts them down.

const breakCard: CardDef = { id: 'test.break', name: 'Break', owner: 'leonora', cost: 0, target: 'chosenEnemy', effects: [damage(mul(1000, stat('attack')))] };
const registry: Registry = { ...gameRegistry, cards: { ...gameRegistry.cards, [breakCard.id]: breakCard } };
const NO_RAPTURE = ['maelia', 'anthe', 'leonora', 'hester'];

const begin = (enemies: EnemyEntry[], party = STARTER_PARTY) => startCombat({ seed: 6, party, enemies }, registry).state;
const fromEncounter = (id: string, party = STARTER_PARTY) => begin(registry.encounters[id]!.enemies, party);
function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
/** Ends `n` turns, with the party at full HP and free of statuses before each, so every number reads at its base. */
const turns = (state: CombatState, n: number) =>
  Array.from({ length: n }).reduce<CombatState>((s) => run({ ...s, party: { ...s.party, hp: s.party.maxHp, statuses: [] } }, { type: 'endTurn' }).state, state);
/** Each enemy's intent as its name and previewed effects (`op status amount`, Shield naming where it lands). */
const shown = (state: CombatState, index = 0) => {
  const enemy = state.enemies[index]!;
  const effects = previewIntent(state, enemy.id, registry).map((p) => {
    const onto = p.op === 'gainShield' && p.target !== enemy.id ? ` → ${state.enemies.find((e) => e.id === p.target)?.enemy}` : '';
    return `${p.op}${p.status ? ` ${p.status}` : ''} ${p.amount}${onto}`;
  });
  return [intentOf(enemy, registry)?.name, effects];
};
/** Each enemy's intents over `n` turns. */
function cycle(state: CombatState, n: number, index = 0) {
  const seen: ReturnType<typeof shown>[] = [];
  let s = state;
  for (let i = 0; i < n; i++) {
    seen.push(shown(s, index));
    s = turns(s, 1);
  }
  return seen;
}
function hit(state: CombatState, target: number) {
  const next = structuredClone(state);
  const uid = `c${next.nextUid++}`;
  next.piles.hand.push({ uid, card: breakCard.id, owner: 'm2' });
  return run(next, { type: 'playCard', card: uid, target: next.enemies[target]!.id });
}

describe('Heron-Stalk (attacker)', () => {
  it('Spear Strike 30, Wade 12 Shield on itself, Snap 52, then again', () => {
    expect(cycle(begin(['enemy.heron-stalk']), 4)).toEqual([
      ['Spear Strike', ['damage 30']],
      ['Wade', ['gainShield 12']],
      ['Snap', ['damage 52']],
      ['Spear Strike', ['damage 30']],
    ]);
  });
});

describe('Thornback Boar (defender)', () => {
  it('Root Down gives every enemy 10 Shield; Gore deals 40', () => {
    const start = fromEncounter('encounter.boar-and-heron');
    expect(shown(start)).toEqual(['Root Down', ['gainShield 10', 'gainShield 10 → enemy.heron-stalk']]);
    const rooted = turns(start, 1);
    // The Heron opens with Spear Strike, so its Shield is the Boar's alone.
    expect(rooted.enemies.map((e) => e.shield)).toEqual([10, 10]);
    expect(shown(rooted)).toEqual(['Gore', ['damage 40']]);
  });
});

describe('Moth-Mantle (debuffer)', () => {
  it('Pollen Dust leaves the party 2 Weak and 4 Poison; Wing Beat deals 30', () => {
    const start = begin(['enemy.moth-mantle']);
    expect(shown(start)).toEqual(['Pollen Dust', ['applyStatus status.weak 2', 'applyStatus status.poison 4']]);
    const dusted = run(start, { type: 'endTurn' }).state;
    expect(dusted.party.statuses).toEqual([
      { status: 'status.weak', stacks: 2 },
      { status: 'status.poison', stacks: 4 },
    ]);
    expect(shown(dusted)).toEqual(['Wing Beat', ['damage 30']]);
  });
});

describe('Litter-Mound (summoner)', () => {
  it('Shed brings one Kit at a time into a free slot, two at most; Smother deals 34; a Kit Nips for 14', () => {
    const start = fromEncounter('encounter.litter-mound', NO_RAPTURE);
    expect(start.enemySlots).toBe(3);
    expect(cycle(start, 2)).toEqual([
      ['Shed', ['summon 1']],
      ['Smother', ['damage 34']],
    ]);
    const kits = (s: CombatState) => s.enemies.filter((e) => e.enemy === 'enemy.kit' && isAlive(e));
    const one = turns(start, 1);
    expect(kits(one).map((e) => e.slot)).toEqual([1]);
    expect(shown(one, 1)).toEqual(['Nip', ['damage 14']]);
    expect(kits(turns(start, 3))).toHaveLength(2);
    // A third Shed finds no room under the cap of two.
    expect(kits(turns(start, 5))).toHaveLength(2);
  });
});

describe('Three-Throated Wolf (elite: slow setups)', () => {
  it('each bite harder than the last, then all three jaws, then from the start; resists control', () => {
    expect(cycle(begin(['enemy.three-throated-wolf']), 5)).toEqual([
      ['Bite', ['damage 25']],
      ['Deeper Bite', ['damage 40']],
      ['Savage Bite', ['damage 55']],
      ['Three Jaws', ['damage 32', 'damage 32', 'damage 32']],
      ['Bite', ['damage 25']],
    ]);
    expect(registry.enemies['enemy.three-throated-wolf']?.traits).toContain('resistsControl');
  });
});

describe('Hive-Bear (elite: kill order)', () => {
  it('the knots Sting for 12 and 2 Poison, then Feed the Hive: 25 Shield each to the Bear, never to themselves', () => {
    const start = fromEncounter('encounter.hive-bear', NO_RAPTURE);
    expect([shown(start, 0), shown(start, 1)]).toEqual([
      ['Maul', ['damage 60']],
      ['Sting', ['damage 12', 'applyStatus status.poison 2']],
    ]);
    const one = turns(start, 1);
    expect(shown(one, 1)).toEqual(['Feed the Hive', ['gainShield 25 → enemy.hive-bear']]);
    expect(shown(one, 0)).toEqual(['Rear Up', ['gainShield 30']]);
    // The Bear Rears Up for 30, and each knot adds 25.
    expect(turns(one, 1).enemies.map((e) => e.shield)).toEqual([80, 0, 0]);
  });

  it('with the Bear dead, the knots feed each other', () => {
    const one = turns(fromEncounter('encounter.hive-bear', NO_RAPTURE), 1);
    const { state } = hit(one, 0);
    expect(shown(state, 1)).toEqual(['Feed the Hive', ['gainShield 25']]);
    expect(turns(state, 1).enemies.map((e) => e.shield)).toEqual([0, 50, 0]);
  });
});

describe('The Gathered Beast (Boss)', () => {
  it('Gathered: Trample 58, Bellow gives the party 2 Weak, Call the Thicket brings two Heron-Stalks to the side lanes', () => {
    const start = fromEncounter('encounter.gathered-beast', NO_RAPTURE);
    expect([start.enemySlots, start.enemies[0]!.maxHp, registry.enemies['enemy.gathered-beast']?.size]).toEqual([3, 1050, 'huge']);
    expect(cycle(start, 3)).toEqual([
      ['Trample', ['damage 58']],
      ['Bellow', ['applyStatus status.weak 2']],
      ['Call the Thicket', ['summon 2']],
    ]);
    expect(turns(start, 3).enemies.filter(isAlive).map((e) => [e.enemy, e.slot])).toEqual([
      ['enemy.gathered-beast', 0],
      ['enemy.heron-stalk', 1],
      ['enemy.heron-stalk', 2],
    ]);
  });

  it('emptying its first bar brings up the second at 1,050; the Peony Opens, then Many Heads: Three Heads 26 ×3, Rend, Gore 90 (135 under Rend)', () => {
    const broken = hit(fromEncounter('encounter.gathered-beast', NO_RAPTURE), 0).state;
    expect(broken.enemies[0]).toMatchObject({ hp: 1050, phase: 1, rousing: true });
    // The preview counts the statuses it would clear: none here.
    expect(shown(broken)).toEqual(['The Peony Opens', ['clearStatuses 0']]);
    expect(cycle(turns(broken, 1), 3)).toEqual([
      ['Three Heads', ['damage 26', 'damage 26', 'damage 26']],
      ['Rend', ['applyStatus status.vulnerable 2']],
      // Gore is 90; Rend's Vulnerable is on the party when it shows, so 135.
      ['Gore', ['damage 135']],
    ]);
  });

  it('at Fruiting it is Full Bloom: Brood brings two Kits, Many Heads 26 ×4, Gore 100', () => {
    expect(registry.encounters['encounter.gathered-beast']?.fruiting).toBe('encounter.gathered-beast-full-bloom');
    const broken = hit(fromEncounter('encounter.gathered-beast-full-bloom', NO_RAPTURE), 0).state;
    expect(cycle(turns(broken, 1), 3)).toEqual([
      ['Brood', ['summon 2']],
      ['Many Heads', ['damage 26', 'damage 26', 'damage 26', 'damage 26']],
      ['Gore', ['damage 100']],
    ]);
  });

  it('emptying its second bar wins the fight', () => {
    const rooted = turns(hit(fromEncounter('encounter.gathered-beast', NO_RAPTURE), 0).state, 1);
    expect(hit(rooted, 0).state.outcome).toBe('victory');
  });
});
