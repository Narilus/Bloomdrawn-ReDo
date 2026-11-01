import { describe, expect, it } from 'vitest';
import {
  apply,
  applyStatus,
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

// Band 3, the Lost Expedition (docs/notes/bestiary.md), at level 1. The party only ends turns,
// healed between them where the enemies would kill it. Fights that count enemy HP across turns or
// have summons use a party without Rapture, so no Tentacle chips or cuts them down.

const card = (id: string, effects: CardDef['effects']): CardDef => ({ id, name: id, owner: 'leonora', cost: 0, target: 'chosenEnemy', effects });
const testCards = [
  card('test.cut', [damage(mul(10, stat('attack')))]),
  card('test.rot', [applyStatus({ id: 'status.poison' }, 20), applyStatus({ id: 'status.bleed' }, 10)]),
  card('test.break', [damage(mul(1000, stat('attack')))]),
  card('test.wound', [loseHp(40, { target: 'chosen' })]),
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
/** The enemy at `index` after a cut from Leonora, the party's Attack × 10. */
const cut = (state: CombatState, index = 0) => play(state, 'test.cut', index).state;

describe('Pack Porter (defender)', () => {
  it('Brace, 15 Shield; Shoulder the Load, 8 Shield to every enemy; Pack Swing 40', () => {
    expect(cycle(fromEncounter('encounter.porter-and-surgeon'), 3)).toEqual([
      ['Brace', ['gainShield 15 on itself']],
      ['Shoulder the Load', ['gainShield 8 on itself', 'gainShield 8 → enemy.field-surgeon']],
      ['Pack Swing', ['damage 40']],
    ]);
  });
});

describe('Field Surgeon (buffer)', () => {
  it('Suture heals the lowest-HP ally 12; Lancet deals 22 and 5 Bleed', () => {
    const start = fromEncounter('encounter.porter-and-surgeon', NO_RAPTURE);
    // Lowest HP, not most missing: the Porter must drop below the Surgeon's own 45.
    const hurt = play(start, 'test.wound', 0).state;
    expect(shown(hurt, 1)).toEqual(['Suture', ['heal 12 → enemy.pack-porter']]);
    const sutured = turns(hurt, 1);
    expect(hp(sutured, 0)).toBe(hp(hurt, 0) + 12);
    expect(shown(sutured, 1)).toEqual(['Lancet', ['damage 22', 'applyStatus status.bleed 5']]);
  });
});

describe('Cartographer (debuffer)', () => {
  it('Survey leaves the party 2 Vulnerable; Compass Point 30; Wrong Turn, the party draws 1 fewer next turn', () => {
    const start = fromEncounter('encounter.cartographer-and-surgeon');
    expect(cycle(start, 3)).toEqual([
      ['Survey', ['applyStatus status.vulnerable 2']],
      // Compass Point is 30; Survey's Vulnerable is on the party when it shows, so 45.
      ['Compass Point', ['damage 45']],
      ['Wrong Turn', ['drawFewer 1']],
    ]);
    // The hand after Wrong Turn is one card short of the turn before's.
    expect(turns(start, 3).piles.hand.length).toBe(turns(start, 2).piles.hand.length - 1);
  });
});

describe('Tent-Walker (summoner)', () => {
  it('Open the Flap lets out one Seedling at a time, two at most; Collapse deals 36 and 12 Shield on itself', () => {
    const start = fromEncounter('encounter.tent-walker', NO_RAPTURE);
    expect(start.enemySlots).toBe(3);
    expect(cycle(start, 2)).toEqual([
      ['Open the Flap', ['summon 1']],
      ['Collapse', ['damage 36', 'gainShield 12 on itself']],
    ]);
    const seedlings = (s: CombatState) => s.enemies.filter((e) => e.enemy === 'enemy.seedling' && isAlive(e));
    expect(seedlings(turns(start, 1))).toHaveLength(1);
    expect(seedlings(turns(start, 3))).toHaveLength(2);
    expect(seedlings(turns(start, 5))).toHaveLength(2);
  });
});

describe('The Quartermaster (elite: racing heals)', () => {
  it('Ration heals itself 60, Cleaver 55, Ration again, Strongbox 40 Shield; resists control', () => {
    const start = cut(fromEncounter('encounter.quartermaster', NO_RAPTURE));
    expect(cycle(start, 4)).toEqual([
      ['Ration', ['heal 60 on itself']],
      ['Cleaver', ['damage 55']],
      ['Ration', ['heal 60 on itself']],
      ['Strongbox', ['gainShield 40 on itself']],
    ]);
    expect(hp(turns(start, 1))).toBe(hp(start) + 60);
    expect(registry.enemies['enemy.quartermaster']?.traits).toContain('resistsControl');
  });
});

describe('The Cocooned Scout (elite: timing)', () => {
  it('fights alone as an elite', () => {
    expect(fromEncounter('encounter.cocooned-scout').enemies.map((e) => e.enemy)).toEqual(['enemy.cocooned-scout']);
  });

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

describe('The Expedition Leader (Boss)', () => {
  it('Muster: Bone Saw 60, Survey gives the party 2 Vulnerable, Call the Crew brings a Pack Porter and a Field Surgeon to the side lanes', () => {
    const start = fromEncounter('encounter.expedition-leader', NO_RAPTURE);
    expect([start.enemySlots, start.enemies[0]!.maxHp, registry.enemies['enemy.expedition-leader']?.size]).toEqual([3, 1100, 'huge']);
    expect(cycle(start, 3)).toEqual([
      ['Bone Saw', ['damage 60']],
      ['Survey', ['applyStatus status.vulnerable 2']],
      ['Call the Crew', ['summon 1', 'summon 1']],
    ]);
    expect(turns(start, 3).enemies.filter(isAlive).map((e) => [e.enemy, e.slot])).toEqual([
      ['enemy.expedition-leader', 0],
      ['enemy.pack-porter', 1],
      ['enemy.field-surgeon', 2],
    ]);
  });

  it('emptying his first bar brings up the second at 1,100; He Opens Himself, then Graft (30 Shield and 20 HP to the lowest-HP ally), Needle Threads 24 ×3, The Last Incision 105', () => {
    const broken = play(fromEncounter('encounter.expedition-leader', NO_RAPTURE), 'test.break').state;
    expect(broken.enemies[0]).toMatchObject({ hp: 1100, phase: 1, rousing: true });
    expect(shown(broken)).toEqual(['He Opens Himself', ['clearStatuses 0 on itself']]);
    const opened = cut(turns(broken, 1));
    expect(cycle(opened, 3)).toEqual([
      ['Graft', ['gainShield 30 on itself', 'heal 20 on itself']],
      ['Needle Threads', ['damage 24', 'damage 24', 'damage 24']],
      ['The Last Incision', ['damage 105']],
    ]);
  });

  it('at Fruiting he is Full Bloom: Call the Crew, Graft twice, The Last Incision 115', () => {
    expect(registry.encounters['encounter.expedition-leader']?.fruiting).toBe('encounter.expedition-leader-full-bloom');
    const broken = play(fromEncounter('encounter.expedition-leader-full-bloom', NO_RAPTURE), 'test.break').state;
    const names = cycle(turns(broken, 1), 4).map(([name]) => name);
    expect(names).toEqual(['Call the Crew', 'Graft', 'Graft', 'The Last Incision']);
    expect(shown(turns(broken, 4))).toEqual(['The Last Incision', ['damage 115']]);
  });

  it('emptying his second bar wins the fight', () => {
    const opened = turns(play(fromEncounter('encounter.expedition-leader', NO_RAPTURE), 'test.break').state, 1);
    expect(play(opened, 'test.break').state.outcome).toBe('victory');
  });
});
