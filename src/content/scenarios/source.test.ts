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

// Band 5, the source (docs/notes/bestiary.md), at level 1. The party only ends turns, healed between
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
/** Each enemy's intent as its name and previewed effects (`op status amount`, or the intent a foretell names, and the enemy it lands on). */
const shown = (state: CombatState, index = 0) => {
  const enemy = state.enemies[index]!;
  const onto = (target: string | undefined) => {
    if (target === enemy.id) return ' on itself';
    const other = state.enemies.find((e) => e.id === target);
    return other ? ` → ${other.enemy}` : '';
  };
  const effects = previewIntent(state, enemy.id, registry).map((p) => `${p.op}${p.status ? ` ${p.status}` : ''}${p.name ? ` ${p.name}` : ` ${p.amount}`}${onto(p.target)}`);
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

/** Ends one turn as it falls: no healing between, so the party's HP shows what landed. */
const endTurn = (state: CombatState) => run(state, { type: 'endTurn' }).state;
const living = (state: CombatState, enemy: string) => state.enemies.filter((e) => e.enemy === enemy && isAlive(e));

describe('Blossom Devourer (attacker)', () => {
  it('Gnash 50; Engulf 30, then heals itself 20', () => {
    const hurt = play(fromEncounter('encounter.blossom-devourer', NO_RAPTURE), 'test.wound').state;
    expect(cycle(hurt, 2)).toEqual([
      ['Gnash', ['damage 50']],
      ['Engulf', ['damage 30', 'heal 20 on itself']],
    ]);
    expect(hp(turns(hurt, 2))).toBe(hp(hurt) + 20);
    expect([registry.enemies['enemy.blossom-devourer']?.hp, registry.enemies['enemy.blossom-devourer']?.size]).toEqual([120, 'large']);
  });

  it('beside a Petal Horror it comes with 90 HP', () => {
    expect(fromEncounter('encounter.devourer-and-petal-horror').enemies.map((e) => [e.enemy, e.maxHp])).toEqual([
      ['enemy.blossom-devourer', 90],
      ['enemy.petal-horror', 60],
    ]);
  });
});

describe('Garden Husk (countdown)', () => {
  const husk = () => begin(['enemy.garden-husk'], NO_RAPTURE);

  it('Harden 20 Shield; Ripen shows the Burst coming next turn; Burst 90, then it withers', () => {
    expect(cycle(husk(), 3)).toEqual([
      ['Harden', ['gainShield 20 on itself']],
      ['Ripen', ['foretell Burst on itself']],
      ['Burst', ['damage 90', 'wither 75 on itself']],
    ]);
  });

  it('the Burst lands, and the Husk withers through its Shield; with it gone the fight is won', () => {
    const bursting = endTurn(endTurn(husk()));
    const before = bursting.party.hp;
    const burst = endTurn({ ...bursting, enemies: bursting.enemies.map((e) => ({ ...e, shield: 20 })) });
    expect(burst.party.hp).toBe(before - 90);
    expect(burst.enemies[0]!.hp).toBe(0);
    expect(burst.outcome).toBe('victory');
  });

  it('party Shield blocks the Burst', () => {
    const bursting = endTurn(endTurn(husk()));
    const shielded = endTurn({ ...bursting, party: { ...bursting.party, shield: 90 } });
    expect(shielded.party.hp).toBe(bursting.party.hp);
  });

  it('killing it on its Ripen turn cancels the Burst, and nothing happens on its death', () => {
    const start = begin(['enemy.garden-husk', 'enemy.garden-husk'], NO_RAPTURE);
    const ripe = endTurn(start);
    expect(shown(ripe)).toEqual(['Ripen', ['foretell Burst on itself']]);
    const killed = play(ripe, 'test.break').state;
    expect(killed.party.hp).toBe(ripe.party.hp);
    // Only the other Husk Bursts.
    expect(endTurn(endTurn(killed)).party.hp).toBe(ripe.party.hp - 90);
  });

  it('beside the Gardener it stands small, and the Gardener anchors', () => {
    const start = fromEncounter('encounter.two-husks-and-gardener');
    expect(start.enemies.map((e) => [e.enemy, e.maxHp])).toEqual([
      ['enemy.gardener', 55],
      ['enemy.sown-husk', 75],
      ['enemy.sown-husk', 75],
    ]);
    expect(registry.enemies['enemy.sown-husk']?.size).toBe('small');
    expect(fromEncounter('encounter.husk-and-petal-horror').enemies[0]!.maxHp).toBe(60);
  });
});

describe('Petal Horror (debuffer)', () => {
  it('Pollen Veil leaves the party 2 Weak and 5 Poison; Tendril Lash 30; Spore-Fall 2 Vulnerable', () => {
    expect(cycle(fromEncounter('encounter.husk-and-petal-horror'), 3, 1)).toEqual([
      ['Pollen Veil', ['applyStatus status.weak 2', 'applyStatus status.poison 5']],
      ['Tendril Lash', ['damage 30']],
      ['Spore-Fall', ['applyStatus status.vulnerable 2']],
    ]);
  });
});

describe('The Grafted Stag (elite: racing statuses)', () => {
  it('Antler Gore 55 and 10 Bleed; Shed Petals 8 Poison; Bellow 2 Weak; resists control', () => {
    const start = fromEncounter('encounter.grafted-stag');
    expect(start.enemies[0]!.maxHp).toBe(850);
    expect(cycle(start, 3)).toEqual([
      ['Antler Gore', ['damage 55', 'applyStatus status.bleed 10']],
      ['Shed Petals', ['applyStatus status.poison 8']],
      ['Bellow', ['applyStatus status.weak 2']],
    ]);
    expect(registry.enemies['enemy.grafted-stag']?.traits).toContain('resistsControl');
  });
});

describe('The Seed-Mother (elite: a countdown)', () => {
  it('Sow brings two small Husks to the side lanes, two at most; Root Slam 50; Nurture, 20 Shield to every enemy; resists control', () => {
    const start = fromEncounter('encounter.seed-mother', NO_RAPTURE);
    expect([start.enemySlots, start.enemies[0]!.maxHp]).toEqual([3, 700]);
    expect(cycle(start, 3)).toEqual([
      ['Sow', ['summon 2']],
      ['Root Slam', ['damage 50']],
      ['Nurture', ['gainShield 20 on itself', 'gainShield 20 → enemy.sown-husk', 'gainShield 20 → enemy.sown-husk']],
    ]);
    expect(turns(start, 1).enemies.map((e) => [e.enemy, e.slot])).toEqual([
      ['enemy.seed-mother', 0],
      ['enemy.sown-husk', 1],
      ['enemy.sown-husk', 2],
    ]);
    // With two still living there is no room, so the next Sow brings none; after their Bursts it sows again.
    expect(shown(turns(start, 3))).toEqual(['Sow', []]);
    expect(living(turns(start, 4), 'enemy.sown-husk')).toHaveLength(0);
    expect(living(turns(start, 7), 'enemy.sown-husk')).toHaveLength(2);
    expect(registry.enemies['enemy.seed-mother']?.traits).toContain('resistsControl');
  });

  it('her Husks count down from the turn they are sown, and wither after their Burst', () => {
    const sown = turns(fromEncounter('encounter.seed-mother', NO_RAPTURE), 1);
    expect(cycle(sown, 3, 1).map(([name]) => name)).toEqual(['Harden', 'Ripen', 'Burst']);
    expect(living(turns(sown, 3), 'enemy.sown-husk')).toHaveLength(0);
  });
});

describe('The Mother Root (Boss)', () => {
  it('first bar: Pulse, 4 Poison; Root Spear 65; Grow brings one small Petal Horror to a side lane, two at most', () => {
    const start = fromEncounter('encounter.mother-root', NO_RAPTURE);
    expect([start.enemySlots, start.enemies[0]!.maxHp, registry.enemies['enemy.mother-root']?.size]).toEqual([3, 1150, 'huge']);
    expect(cycle(start, 3)).toEqual([
      ['Pulse', ['applyStatus status.poison 4']],
      ['Root Spear', ['damage 65']],
      ['Grow', ['summon 1']],
    ]);
    expect(living(turns(start, 3), 'enemy.grown-petal-horror').map((e) => e.slot)).toEqual([1]);
    expect(living(turns(start, 6), 'enemy.grown-petal-horror').map((e) => e.slot)).toEqual([1, 2]);
    expect([registry.enemies['enemy.grown-petal-horror']?.hp, registry.enemies['enemy.grown-petal-horror']?.size]).toEqual([60, 'small']);
    expect(registry.enemies['enemy.mother-root']?.traits).toContain('resistsControl');
  });

  it('emptying her first bar brings up the Flowering Heart at 1,150: Opening, then Pollen Breath, 2 Weak and 1 Vulnerable; Petal Storm 18 ×4; Heartbloom 90', () => {
    const broken = play(fromEncounter('encounter.mother-root', NO_RAPTURE), 'test.break').state;
    expect(broken.enemies[0]).toMatchObject({ hp: 1150, phase: 1, rousing: true });
    expect(shown(broken)).toEqual(['Opening', ['clearStatuses 0 on itself']]);
    // The Petal Storm shows Pollen Breath's Vulnerable on it: 18 a hit at its base.
    expect(cycle(turns(broken, 1), 3)).toEqual([
      ['Pollen Breath', ['applyStatus status.weak 2', 'applyStatus status.vulnerable 1']],
      ['Petal Storm', ['damage 27', 'damage 27', 'damage 27', 'damage 27']],
      ['Heartbloom', ['damage 90']],
    ]);
  });

  it("Pollen Breath's Vulnerable is spent on the Petal Storm, so the Heartbloom lands at its base", () => {
    const breathed = turns(turns(play(fromEncounter('encounter.mother-root', NO_RAPTURE), 'test.break').state, 1), 1);
    const stormed = endTurn(breathed);
    expect(breathed.party.hp - stormed.party.hp).toBe(4 * 27);
    expect(shown(stormed)).toEqual(['Heartbloom', ['damage 90']]);
  });

  it('at Fruiting she is Full Bloom: Fruit, two small Husks; Petal Storm 18 ×5; Heartbloom 100', () => {
    expect(registry.encounters['encounter.mother-root']?.fruiting).toBe('encounter.mother-root-full-bloom');
    const broken = play(fromEncounter('encounter.mother-root-full-bloom', NO_RAPTURE), 'test.break').state;
    const flowering = turns(broken, 1);
    expect(cycle(flowering, 3)).toEqual([
      ['Fruit', ['summon 2']],
      ['Petal Storm', ['damage 18', 'damage 18', 'damage 18', 'damage 18', 'damage 18']],
      ['Heartbloom', ['damage 100']],
    ]);
    expect(living(turns(flowering, 1), 'enemy.sown-husk')).toHaveLength(2);
  });

  it('emptying her second bar wins the fight', () => {
    const flowering = turns(play(fromEncounter('encounter.mother-root', NO_RAPTURE), 'test.break').state, 1);
    expect(play(flowering, 'test.break').state.outcome).toBe('victory');
  });
});
