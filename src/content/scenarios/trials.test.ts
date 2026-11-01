import { describe, expect, it } from 'vitest';
import { apply, damage, intentOf, isAlive, loseHp, mul, previewIntent, stat, startCombat, type CardDef, type CombatState, type Command, type Registry } from '../../engine/index.ts';
import { registry as gameRegistry } from '../registry.ts';

// Trials (docs/notes/trials.md): the four Domain bosses at level 1. The party only ends turns,
// healed between them, with no Rapture, so no Tentacle chips the bosses or cuts their adds down.

const card = (id: string, effects: CardDef['effects']): CardDef => ({ id, name: id, owner: 'leonora', cost: 0, target: 'chosenEnemy', effects });
const testCards = [card('test.break', [damage(mul(1000, stat('attack')))]), card('test.wound', [loseHp(20, { target: 'chosen' })])];
const NO_RAPTURE = ['maelia', 'anthe', 'leonora', 'hester'];
const registry: Registry = { ...gameRegistry, cards: { ...gameRegistry.cards, ...Object.fromEntries(testCards.map((c) => [c.id, c])) } };

const fromEncounter = (id: string) => startCombat({ seed: 6, party: NO_RAPTURE, enemies: registry.encounters[id]!.enemies }, registry).state;
function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
/** Ends `n` turns, with the party at full HP and free of statuses before each, so every number reads at its base. */
const turns = (state: CombatState, n: number) =>
  Array.from({ length: n }).reduce<CombatState>((s) => run({ ...s, party: { ...s.party, hp: s.party.maxHp, statuses: [] } }, { type: 'endTurn' }).state, state);
/** An enemy's intent as its name and previewed effects (`op status amount`, or the intent a foretell names, and the enemy it lands on). */
const shown = (state: CombatState, index = 0) => {
  const enemy = state.enemies[index]!;
  const onto = (target: string | undefined) => {
    if (target === enemy.id) return ' on itself';
    const other = state.enemies.find((e) => e.id === target);
    return other ? ` → ${other.enemy}` : '';
  };
  const effects = previewIntent(state, enemy.id, registry).map((p) => `${p.op}${p.status ? ` ${p.status}` : ''}${p.name ? ` ${p.name}` : ` ${p.amount}`}${onto(p.target)}`);
  return [intentOf(enemy, registry)?.name, effects] as const;
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
const stacksOf = (state: CombatState, status: string, index = 0) => state.enemies[index]!.statuses.find((s) => s.status === status)?.stacks ?? 0;
const living = (state: CombatState, enemy: string) => state.enemies.filter((e) => e.enemy === enemy && isAlive(e));
/** The boss broken into its second bar, past its Rouse. */
const secondBar = (state: CombatState) => turns(play(state, 'test.break').state, 1);

describe('every Trial boss', () => {
  it.each(['grand-anatomist', 'veiled-hierophant', 'kirin-oracle', 'ringmaster'])('%s: huge, resists control, two bars, a Rouse that clears its statuses, and emptying the second wins', (name) => {
    const def = registry.enemies[`enemy.${name}`]!;
    expect([def.size, def.traits, def.phases?.length]).toEqual(['huge', ['resistsControl'], 1]);
    const start = fromEncounter(`encounter.${name}`);
    const broken = play(start, 'test.break').state;
    expect(broken.enemies[0]).toMatchObject({ phase: 1, rousing: true });
    expect(previewIntent(broken, broken.enemies[0]!.id, registry).map((p) => p.op)).toEqual(['clearStatuses']);
    expect(play(turns(broken, 1), 'test.break').state.outcome).toBe('victory');
  });
});

describe('The Grand Anatomist (Flesh: build and burst)', () => {
  const anatomist = () => fromEncounter('encounter.grand-anatomist');
  const gestation = (state: CombatState) => stacksOf(state, 'status.gestation');

  it('Consultation at 1,100: Incision 30 and 6 Bleed; Gestate 3; Suture heals 40 and gains 30 Shield; Delivery hits 20 for each Gestation, shown on the intent, then spends it all', () => {
    const start = play(anatomist(), 'test.wound').state;
    expect(start.enemies[0]!.maxHp).toBe(1100);
    expect(cycle(start, 4)).toEqual([
      ['Incision', ['damage 30', 'applyStatus status.bleed 6']],
      ['Gestate', ['applyStatus status.gestation 3 on itself']],
      ['Suture', ['heal 20 on itself', 'gainShield 30 on itself']],
      ['Delivery', ['damage 60', 'reduceStacks status.gestation 3']],
    ]);
    expect(gestation(turns(start, 4))).toBe(0);
  });

  it('The Theatre: Gestate 3; Incision; Gestate 3; Delivery, so twice the first bar\'s', () => {
    const theatre = secondBar(anatomist());
    expect(theatre.enemies[0]!.maxHp).toBe(1100);
    expect(cycle(theatre, 3).map(([name]) => name)).toEqual(['Gestate', 'Incision', 'Gestate']);
    const due = turns(theatre, 3);
    expect(gestation(due)).toBe(6);
    expect(shown(due)).toEqual(['Delivery', ['damage 120', 'reduceStacks status.gestation 6']]);
    const { state: delivered, events } = run({ ...due, party: { ...due.party, hp: due.party.maxHp } }, { type: 'endTurn' });
    expect(events.filter((e) => e.type === 'damageDealt' && e.source === due.enemies[0]!.id).map((e) => e.amount)).toEqual([120]);
    expect(gestation(delivered)).toBe(0);
  });

  it('her Rouse clears her Gestation, so breaking the first bar fast takes away what she grew', () => {
    const grown = turns(anatomist(), 2);
    expect(gestation(grown)).toBe(3);
    expect(gestation(secondBar(grown))).toBe(0);
  });
});

describe('The Veiled Hierophant (Rapture: count × damage)', () => {
  const hierophant = () => fromEncounter('encounter.veiled-hierophant');
  const fervour = (state: CombatState, index = 0) => stacksOf(state, 'status.fervour', index);

  it('Vespers at 1,000: Raise a Limb; Sermon, every enemy 1 Fervour; Censer, 2 Weak', () => {
    const start = hierophant();
    expect([start.enemies[0]!.maxHp, start.enemySlots]).toEqual([1000, 4]);
    expect(cycle(start, 3)).toEqual([
      ['Raise a Limb', ['summon 1']],
      ['Sermon', ['applyStatus status.fervour 1 on itself', 'applyStatus status.fervour 1 → enemy.raised-limb']],
      ['Censer', ['applyStatus status.weak 2']],
    ]);
  });

  it('her Limbs are small and Lash 12 every turn; each Fervour adds 6 to every hit', () => {
    expect([registry.enemies['enemy.raised-limb']?.hp, registry.enemies['enemy.raised-limb']?.size]).toEqual([40, 'small']);
    const raised = turns(hierophant(), 1);
    expect(shown(raised, 1)).toEqual(['Lash', ['damage 12']]);
    const preached = turns(raised, 1);
    expect([fervour(preached), fervour(preached, 1)]).toEqual([1, 1]);
    expect(shown(preached, 1)).toEqual(['Lash', ['damage 18']]);
  });

  it('she raises at most three; a dead Limb leaves room for the next', () => {
    const many = turns(hierophant(), 9);
    expect(living(many, 'enemy.raised-limb')).toHaveLength(3);
    const cut = play(many, 'test.break', 1).state;
    expect(living(cut, 'enemy.raised-limb')).toHaveLength(2);
  });

  it('Compline: Raise Two Limbs; Sermon 2; Communion 90, and her own Fervour raises it. Her Rouse clears her Fervour; her Limbs keep theirs', () => {
    const preached = turns(hierophant(), 2);
    const compline = secondBar(preached);
    expect([fervour(compline), fervour(compline, 1)]).toEqual([0, 1]);
    expect(cycle(compline, 3).map(([name, effects]) => [name, effects[0]])).toEqual([
      ['Raise Two Limbs', 'summon 2'],
      ['Sermon', 'applyStatus status.fervour 2 on itself'],
      ['Communion', 'damage 102'],
    ]);
  });
});

describe('The Kirin Oracle (Spirit: the delayed payoff)', () => {
  const oracle = () => fromEncounter('encounter.kirin-oracle');
  const sanctity = (state: CombatState) => stacksOf(state, 'status.sanctity');

  it('Invocation at 1,000: Hang Talismans, two; Hoof Strike 50; Kindle names The Rite a turn ahead; The Rite 40 and 20 a Sanctity, then spends it', () => {
    const start = oracle();
    expect(start.enemies[0]!.maxHp).toBe(1000);
    expect(cycle(start, 4)).toEqual([
      ['Hang Talismans', ['summon 2']],
      ['Hoof Strike', ['damage 50']],
      ['Kindle', ['foretell The Rite on itself']],
      // Two Talismans have chanted twice: 40 + 4 × 20.
      ['The Rite', ['damage 120', 'reduceStacks status.sanctity 4']],
    ]);
  });

  it('each Talisman left hanging Chants a Sanctity into her every turn, so The Rite grows with them', () => {
    expect([registry.enemies['enemy.paper-talisman']?.hp, registry.enemies['enemy.paper-talisman']?.size]).toEqual([35, 'small']);
    const hung = turns(oracle(), 1);
    expect(shown(hung, 1)).toEqual(['Chant', ['applyStatus status.sanctity 1 → enemy.kirin-oracle']]);
    expect(sanctity(turns(hung, 1))).toBe(2);
    // Both cut down at once: nothing more is chanted, and The Rite is its base.
    const cut = play(play(hung, 'test.break', 1).state, 'test.break', 2).state;
    const rite = turns(cut, 2);
    expect(shown(rite)).toEqual(['The Rite', ['damage 40']]);
    // The Rite spends all 4; the Talismans, acting after her, chant 2 anew.
    const spent = turns(oracle(), 4);
    expect(sanctity(spent)).toBe(2);
  });

  it('Ascension: Hang Talismans; Tranquil Ward, 60 Shield; Kindle; The Rite', () => {
    const ascension = secondBar(oracle());
    expect(cycle(ascension, 4).map(([name, effects]) => [name, effects[0]])).toEqual([
      ['Hang Talismans', 'summon 2'],
      ['Tranquil Ward', 'gainShield 60 on itself'],
      ['Kindle', 'foretell The Rite on itself'],
      ['The Rite', 'damage 120'],
    ]);
  });
});

describe('The Ringmaster (Unbound: the economy)', () => {
  const ringmaster = () => fromEncounter('encounter.ringmaster');

  it('The Overture at 1,000: Whip Crack 45 and 2 Vulnerable; Sleight of Hand, draw 2 fewer; Raise the Marionettes, two', () => {
    const start = ringmaster();
    expect(start.enemies[0]!.maxHp).toBe(1000);
    expect(cycle(start, 3)).toEqual([
      ['Whip Crack', ['damage 45', 'applyStatus status.vulnerable 2']],
      ['Sleight of Hand', ['drawFewer 2']],
      ['Raise the Marionettes', ['summon 2']],
    ]);
  });

  it('his Marionettes come in pairs, the second a step behind, so one Dances 20 while the other Bows 20 Shield onto him', () => {
    expect([registry.enemies['enemy.marionette']?.hp, registry.enemies['enemy.marionette']?.size]).toEqual([50, 'small']);
    const raised = turns(ringmaster(), 3);
    expect(living(raised, 'enemy.marionette').map((e) => e.statuses.map((s) => s.status))).toEqual([[], ['status.delay']]);
    expect(cycle(raised, 2, 1)).toEqual([
      ['Dance', ['damage 20']],
      ['Bow', ['gainShield 20 → enemy.ringmaster']],
    ]);
    expect(cycle(raised, 3, 2).map(([name]) => name)).toEqual(['Dance', 'Dance', 'Bow']);
  });

  it('The Main Act: Whip Crack; Knife-Thrower 15 five times; Toll the House, 2 Mana debt; Grand Finale 110', () => {
    const act = secondBar(ringmaster());
    expect(cycle(act, 4).map(([name, effects]) => [name, effects[0]])).toEqual([
      ['Whip Crack', 'damage 45'],
      ['Knife-Thrower', 'repeat 5'],
      ['Toll the House', 'manaDebt 2'],
      ['Grand Finale', 'damage 110'],
    ]);
    const knives = turns(act, 1);
    const { events } = run({ ...knives, party: { ...knives.party, hp: knives.party.maxHp, statuses: [] } }, { type: 'endTurn' });
    expect(events.filter((e) => e.type === 'damageDealt' && e.source === knives.enemies[0]!.id).map((e) => e.amount)).toEqual([15, 15, 15, 15, 15]);
  });

  it("the Main Act's Vulnerable carries the knives and is gone by the Grand Finale", () => {
    // Ended as they fall, healed but keeping statuses.
    const next = (state: CombatState) => run({ ...state, party: { ...state.party, hp: state.party.maxHp } }, { type: 'endTurn' }).state;
    const cracked = next(secondBar(ringmaster()));
    expect(cracked.party.statuses.map((x) => x.status)).toContain('status.vulnerable');
    expect(shown(cracked)).toEqual(['Knife-Thrower', ['repeat 5']]);
    const finale = next(next(cracked));
    expect(finale.party.statuses.map((x) => x.status)).not.toContain('status.vulnerable');
    expect(shown(finale)).toEqual(['Grand Finale', ['damage 110']]);
  });
});
