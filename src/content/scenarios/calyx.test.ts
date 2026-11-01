import { describe, expect, it } from 'vitest';
import {
  apply,
  damage,
  intentOf,
  isAlive,
  loseHp,
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

// Band 4, the Calyx (docs/notes/bestiary.md), at level 1. The party only ends turns, healed between
// them where the enemies would kill it. Fights that count enemy HP across turns or have summons use
// a party without Rapture, so no Tentacle chips or cuts them down.

const card = (id: string, effects: CardDef['effects']): CardDef => ({ id, name: id, owner: 'leonora', cost: 0, target: 'chosenEnemy', effects });
const testCards = [
  card('test.cut', [damage(mul(10, stat('attack')))]),
  card('test.break', [damage(mul(1000, stat('attack')))]),
  card('test.wound', [loseHp(20, { target: 'chosen' })]),
];
const NO_RAPTURE = ['maelia', 'anthe', 'leonora', 'hester'];
const registry: Registry = { ...gameRegistry, cards: { ...gameRegistry.cards, ...Object.fromEntries(testCards.map((c) => [c.id, c])) } };

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
/** Each enemy's intent as its name and previewed effects (`op status amount`, naming the enemy it lands on). */
const shown = (state: CombatState, index = 0) => {
  const enemy = state.enemies[index]!;
  const onto = (target: string | undefined) => {
    if (target === enemy.id) return ' on itself';
    const other = state.enemies.find((e) => e.id === target);
    return other ? ` → ${other.enemy}` : '';
  };
  const effects = previewIntent(state, enemy.id, registry).map((p) => `${p.op}${p.status ? ` ${p.status}` : ''} ${p.amount}${onto(p.target)}`);
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
/** Sets enemies' HP straight, by index. */
function withHp(state: CombatState, hps: [number, number][]) {
  const next = structuredClone(state);
  for (const [index, value] of hps) next.enemies[index]!.hp = value;
  return next;
}

describe('Pollinator (debuffer)', () => {
  it('Pollen Cloud leaves the party 4 Poison and 2 Weak; Sting 30; large when it fights without the Queen', () => {
    const start = fromEncounter('encounter.two-pollinators');
    expect(cycle(start, 3)).toEqual([
      ['Pollen Cloud', ['applyStatus status.poison 4', 'applyStatus status.weak 2']],
      ['Sting', ['damage 30']],
      ['Pollen Cloud', ['applyStatus status.poison 4', 'applyStatus status.weak 2']],
    ]);
    expect([start.enemies[0]!.maxHp, registry.enemies['enemy.pollinator']?.size]).toEqual([50, 'large']);
  });
});

describe('Gardener (buffer)', () => {
  it("Tend heals 12 and Graft gives 15 Shield by Suture's rule; Prune 32", () => {
    // With only itself hurt, both fall to the Gardener (owner, 1 Nov).
    const hurt = play(fromEncounter('encounter.pollinator-and-gardener', NO_RAPTURE), 'test.wound', 1).state;
    expect(cycle(hurt, 3, 1)).toEqual([
      ['Tend', ['heal 12 on itself']],
      ['Graft', ['gainShield 15 on itself']],
      ['Prune', ['damage 32']],
    ]);
  });

  it('Tend and Graft go to the hurt ally', () => {
    const hurt = play(fromEncounter('encounter.grazer-and-gardener', NO_RAPTURE), 'test.wound', 0).state;
    expect(shown(hurt, 1)).toEqual(['Tend', ['heal 12 → enemy.stilt-grazer']]);
    const tended = turns(hurt, 1);
    expect(hp(tended)).toBe(hp(hurt) + 12);
    const hurtAgain = play(tended, 'test.wound', 0).state;
    expect(shown(hurtAgain, 1)).toEqual(['Graft', ['gainShield 15 → enemy.stilt-grazer']]);
    expect(turns(hurtAgain, 1).enemies[0]!.shield).toBe(15);
  });
});

describe('Stilt-Grazer (attacker)', () => {
  it('Trample 60; Graze 30', () => {
    expect(cycle(fromEncounter('encounter.stilt-grazer'), 2)).toEqual([
      ['Trample', ['damage 60']],
      ['Graze', ['damage 30']],
    ]);
  });
});

describe('Seed-Bladder (summoner)', () => {
  it('Drop lets fall one Seedling at a time, two at most; Burst Spores leaves the party 6 Poison', () => {
    const start = fromEncounter('encounter.bladder-and-pollinator', NO_RAPTURE);
    expect(start.enemySlots).toBe(4);
    expect(cycle(start, 2)).toEqual([
      ['Drop', ['summon 1']],
      ['Burst Spores', ['applyStatus status.poison 6']],
    ]);
    const seedlings = (s: CombatState) => s.enemies.filter((e) => e.enemy === 'enemy.seedling' && isAlive(e));
    expect(seedlings(turns(start, 1))).toHaveLength(1);
    expect(seedlings(turns(start, 3))).toHaveLength(2);
    expect(seedlings(turns(start, 5))).toHaveLength(2);
  });
});

describe('The Weaver (elite: thin hand)', () => {
  it('Bind, the party draws 1 fewer next turn; Lash 50; Bind; Reel In 95; resists control', () => {
    const start = fromEncounter('encounter.weaver');
    expect(cycle(start, 5)).toEqual([
      ['Bind', ['drawFewer 1']],
      ['Lash', ['damage 50']],
      ['Bind', ['drawFewer 1']],
      ['Reel In', ['damage 95']],
      ['Bind', ['drawFewer 1']],
    ]);
    expect(registry.enemies['enemy.weaver']?.traits).toContain('resistsControl');
  });

  it('each Bind leaves the next hand one card short', () => {
    const start = fromEncounter('encounter.weaver');
    const hand = (n: number) => turns(start, n).piles.hand.length;
    expect([hand(1), hand(3)]).toEqual([hand(2) - 1, hand(2) - 1]);
  });
});

describe('The Pollen Queen (elite: kill order)', () => {
  it('stands large between two attending Pollinators of 90, small beside her', () => {
    const start = fromEncounter('encounter.pollen-queen', NO_RAPTURE);
    expect(start.enemies.map((e) => [e.enemy, e.maxHp])).toEqual([
      ['enemy.pollen-queen', 450],
      ['enemy.attending-pollinator', 90],
      ['enemy.attending-pollinator', 90],
    ]);
    expect([registry.enemies['enemy.pollen-queen']?.size, registry.enemies['enemy.attending-pollinator']?.size]).toEqual(['large', 'small']);
  });

  it('Crush 70; Royal Jelly heals herself 50; resists control', () => {
    const start = play(fromEncounter('encounter.pollen-queen', NO_RAPTURE), 'test.cut').state;
    expect(cycle(start, 2)).toEqual([
      ['Crush', ['damage 70']],
      ['Royal Jelly', ['heal 50 on itself']],
    ]);
    expect(hp(turns(start, 2))).toBe(Math.min(450, hp(start) + 50));
    expect(registry.enemies['enemy.pollen-queen']?.traits).toContain('resistsControl');
  });

  it('her Pollinators Pollen Cloud, Sting, then Attend: 25 Shield to the Queen, or with her dead to the first Pollinator', () => {
    const start = fromEncounter('encounter.pollen-queen', NO_RAPTURE);
    expect(cycle(start, 3, 1)).toEqual([
      ['Pollen Cloud', ['applyStatus status.poison 4', 'applyStatus status.weak 2']],
      ['Sting', ['damage 30']],
      ['Attend', ['gainShield 25 → enemy.pollen-queen']],
    ]);
    expect(turns(start, 3).enemies[0]!.shield).toBe(50);
    const queenless = withHp(turns(start, 2), [[0, 0]]);
    // The most max HP, itself included; the two tie, so both Shield the earlier one.
    expect(shown(queenless, 1)).toEqual(['Attend', ['gainShield 25 on itself']]);
    expect(shown(queenless, 2)).toEqual(['Attend', ['gainShield 25 → enemy.attending-pollinator']]);
  });
});

describe('The Crowned Pistil (Boss)', () => {
  it('first bar: Pollen Fall, 6 Poison and 2 Weak; Stamen Lash 60; Call the Pollinators brings two small ones of 50 to the side lanes', () => {
    const start = fromEncounter('encounter.crowned-pistil', NO_RAPTURE);
    expect([start.enemySlots, start.enemies[0]!.maxHp, registry.enemies['enemy.crowned-pistil']?.size]).toEqual([3, 1100, 'huge']);
    expect(cycle(start, 3)).toEqual([
      ['Pollen Fall', ['applyStatus status.poison 6', 'applyStatus status.weak 2']],
      ['Stamen Lash', ['damage 60']],
      ['Call the Pollinators', ['summon 2']],
    ]);
    expect(turns(start, 3).enemies.filter(isAlive).map((e) => [e.enemy, e.slot])).toEqual([
      ['enemy.crowned-pistil', 0],
      ['enemy.flanking-pollinator', 1],
      ['enemy.flanking-pollinator', 2],
    ]);
    expect([registry.enemies['enemy.flanking-pollinator']?.hp, registry.enemies['enemy.flanking-pollinator']?.size]).toEqual([50, 'small']);
  });

  it('emptying her first bar brings up the second at 1,100; the Petals Part, then Close the Bud 60 Shield, Open 100, Stamen Lash 28 ×3, Pollen Fall', () => {
    const broken = play(fromEncounter('encounter.crowned-pistil', NO_RAPTURE), 'test.break').state;
    expect(broken.enemies[0]).toMatchObject({ hp: 1100, phase: 1, rousing: true });
    expect(shown(broken)).toEqual(['The Petals Part', ['clearStatuses 0 on itself']]);
    expect(cycle(turns(broken, 1), 4)).toEqual([
      ['Close the Bud', ['gainShield 60 on itself']],
      ['Open', ['damage 100']],
      ['Stamen Lash', ['damage 28', 'damage 28', 'damage 28']],
      ['Pollen Fall', ['applyStatus status.poison 6', 'applyStatus status.weak 2']],
    ]);
  });

  it('at Fruiting she is Full Bloom: Close the Bud, Open 110, Call the Pollinators, Stamen Lash 28 ×4', () => {
    expect(registry.encounters['encounter.crowned-pistil']?.fruiting).toBe('encounter.crowned-pistil-full-bloom');
    const broken = play(fromEncounter('encounter.crowned-pistil-full-bloom', NO_RAPTURE), 'test.break').state;
    expect(cycle(turns(broken, 1), 4)).toEqual([
      ['Close the Bud', ['gainShield 60 on itself']],
      ['Open', ['damage 110']],
      ['Call the Pollinators', ['summon 2']],
      ['Stamen Lash', ['damage 28', 'damage 28', 'damage 28', 'damage 28']],
    ]);
  });

  it('emptying her second bar wins the fight', () => {
    const parted = turns(play(fromEncounter('encounter.crowned-pistil', NO_RAPTURE), 'test.break').state, 1);
    expect(play(parted, 'test.break').state.outcome).toBe('victory');
  });
});
