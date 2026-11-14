import { describe, expect, it } from 'vitest';
import { characterOf, critChance, type CombatState, type EngineEvent, type Registry, type WeaponDef } from '../../engine/index.ts';
import { registry } from '../registry.ts';
import { runScenario, withoutCrit, type ScenarioRun, type ScenarioSpec } from '../testing/scenario.ts';

// Weapons (docs/notes/weapons.md): one scenario or more per weapon effect. Each run is set beside the
// same run with a blank copy of the weapon (its main stat, no effect), so stats match and only the
// effect differs. Stats are read off the member, so retuning a kit's numbers doesn't break these.

const blankId = (id: string) => `test.blank.${id.replace(/^weapon\./, '')}`;
const blanks = Object.fromEntries(
  Object.values(registry.weapons).map((w): [string, WeaponDef] => [blankId(w.id), { ...w, id: blankId(w.id), steps: w.steps.map((s) => ({ text: s.text })) }]),
);
const content: Registry = { ...registry, weapons: { ...registry.weapons, ...blanks } };

const HOUND = 'enemy.bloom-rib-hound';
const FLESH = ['maelia', 'virelle', 'agathe', 'leonora'];
const RAPTURE = ['isadora', 'agathe', 'anthe', 'leonora'];
const SPIRIT = ['anthe', 'kibane', 'agathe', 'leonora'];
const UNBOUND = ['leonora', 'hester', 'maelia', 'agathe'];

/** The run with the weapon, and the same run with its blank. */
function both(spec: ScenarioSpec, wielder: string, weapon: string, step?: number): [ScenarioRun, ScenarioRun] {
  const armed = { weapon, ...(step !== undefined && { step }) };
  return [runScenario({ ...spec, weapons: { [wielder]: armed } }, content), runScenario({ ...spec, weapons: { [wielder]: blankId(weapon) } }, content)];
}

const member = (state: CombatState, character: string) => state.members.find((m) => m.character === character)!;
const statOf = (state: CombatState, character: string, stat: 'hp' | 'attack' | 'defense') => characterOf(member(state, character), content)!.stats[stat];
const lost = (run: ScenarioRun, slot = 0) => run.state.enemies[slot]!.maxHp - run.state.enemies[slot]!.hp;
const stacksOn = (run: ScenarioRun, status: string, slot = 0) => run.state.enemies[slot]!.statuses.find((s) => s.status === status)?.stacks ?? 0;
const allEvents = (run: ScenarioRun): EngineEvent[] => run.plays.flatMap((p) => p.events);
/** Shield the wielder's own hooks gave: events whose source is that member, from a trigger (not a card). */
const shieldFrom = (run: ScenarioRun, character: string) =>
  allEvents(run).filter((e) => e.type === 'shieldGained' && e.source === member(run.state, character).id && e.card === undefined).map((e) => e.amount);
const down = (x: number) => Math.floor(x + 1e-9);

describe('a weapon in hand', () => {
  it('adds its main stat: a share of HP, Attack or Defense, or crit points', () => {
    const state = runScenario({ party: ['maelia', 'virelle', 'isadora', 'kibane'], weapons: { maelia: 'weapon.seed-orb-staff', virelle: 'weapon.thorn-rapier', isadora: 'weapon.torn-veil', kibane: 'weapon.foxfire-gauntlet' }, play: [] }, registry).state;
    const stats = (c: string) => characterOf(member(state, c), registry)!.stats;
    expect(stats('maelia').defense).toBe(Math.round(registry.characters.maelia!.stats.defense * 1.3));
    expect(stats('kibane').attack).toBe(Math.round(registry.characters.kibane!.stats.attack * 1.3));
    expect(stats('virelle').critDamage).toBe(50 + 24);
    // Crit points go on top of the character's own 5%.
    expect(stats('isadora').critRate).toBe(5 + 12);
  });

  it('reinforced, its effect grows by a tenth a step: Bleed +30% at +5', () => {
    const [plus5] = both({ party: FLESH, setup: { hand: ['virelle.suture-cut'] }, play: [{ card: 'virelle.suture-cut', target: 0 }] }, 'virelle', 'weapon.thorn-rapier', 5);
    expect(stacksOn(plus5, 'status.bleed')).toBe(down(1.5 * statOf(plus5.state, 'virelle', 'attack') * 1.3));
    expect(registry.weapons['weapon.thorn-rapier']!.steps[5]!.text).toContain('30%');
  });
});

describe('signature weapons', () => {
  it("Seed-Orb Staff: the wielder's Embryo consumed gives the party Shield, 10% of Defense each", () => {
    const spec: ScenarioSpec = { setup: { resources: { embryo: 3 }, gauges: { maelia: 100 } }, play: [{ ultimate: 'maelia' }] };
    const [armed, blank] = both(spec, 'maelia', 'weapon.seed-orb-staff');
    expect(armed.state.party.shield - blank.state.party.shield).toBe(down(0.1 * statOf(armed.state, 'maelia', 'defense') * 3));
    // On someone else, Maelia's consuming gives nothing.
    const [other, otherBlank] = both(spec, 'agathe', 'weapon.seed-orb-staff');
    expect(other.state.party.shield).toBe(otherBlank.state.party.shield);
  });

  it('Chalk-Circle Censer: the first Tentacle gain each turn adds 10% of Attack to every hit', () => {
    const spec: ScenarioSpec = { setup: { hand: ['agathe.call-the-choir', 'agathe.call-the-choir'] }, play: [{ card: 'agathe.call-the-choir' }, { card: 'agathe.call-the-choir' }] };
    const [armed, blank] = both(spec, 'agathe', 'weapon.chalk-circle-censer');
    const potency = (run: ScenarioRun, i: number) => run.plays[i]!.after.resources.potency! - run.plays[i]!.before.resources.potency!;
    expect(potency(armed, 0) - potency(blank, 0)).toBeCloseTo(0.1 * statOf(armed.state, 'agathe', 'attack'));
    expect(potency(armed, 1)).toBe(potency(blank, 1));
  });

  it('Vigil Lamp: Ritual damage +10% a turn held, up to 3', () => {
    const candle = (held: number) => both({ setup: { hand: ['anthe.votive-candle'], held: { 'anthe.votive-candle': held } }, play: [{ card: 'anthe.votive-candle', target: 0 }] }, 'anthe', 'weapon.vigil-lamp');
    for (const [held, mul] of [[0, 1], [2, 1.2], [5, 1.3]] as const) {
      const [armed, blank] = candle(held);
      const attack = statOf(armed.state, 'anthe', 'attack');
      expect(lost(blank)).toBe(down(2.67 * attack));
      expect(lost(armed), `held ${held}`).toBe(down(2.67 * attack * mul));
    }
  });

  it("Sealed Ledger: the wielder's Shield cards add 20% of Defense for each Mana owed", () => {
    const [armed, blank] = both({ setup: { hand: ['leonora.promissory-note', 'leonora.defense'] }, play: [{ card: 'leonora.promissory-note' }, { card: 'leonora.defense' }] }, 'leonora', 'weapon.sealed-ledger');
    const defense = statOf(armed.state, 'leonora', 'defense');
    expect(armed.state.manaDebt).toBe(2);
    expect(blank.state.party.shield).toBe(down(2.67 * defense));
    expect(armed.state.party.shield).toBe(down(2.67 * defense + 0.2 * defense * 2));
    // Owing nothing, it adds nothing.
    const [clear, clearBlank] = both({ setup: { hand: ['leonora.defense'] }, play: [{ card: 'leonora.defense' }] }, 'leonora', 'weapon.sealed-ledger');
    expect(clear.state.party.shield).toBe(clearBlank.state.party.shield);
    // An ultimate's Shield isn't a card's, owed Mana or not.
    const [ult, ultBlank] = both(
      { setup: { hand: ['leonora.promissory-note'], resources: { embryo: 3 }, gauges: { maelia: 100 } }, play: [{ card: 'leonora.promissory-note' }, { ultimate: 'maelia' }] },
      'maelia',
      'weapon.sealed-ledger',
    );
    expect(ult.state.party.shield).toBe(ultBlank.state.party.shield);
  });

  it('Thorn Rapier: Bleed the wielder applies is 20% more', () => {
    const [armed, blank] = both({ party: FLESH, setup: { hand: ['virelle.suture-cut'] }, play: [{ card: 'virelle.suture-cut', target: 0 }] }, 'virelle', 'weapon.thorn-rapier');
    const attack = statOf(armed.state, 'virelle', 'attack');
    expect(stacksOn(blank, 'status.bleed')).toBe(down(1.5 * attack));
    expect(stacksOn(armed, 'status.bleed')).toBe(down(1.5 * attack * 1.2));
  });

  it("Torn Veil: during anyone's Dance of Bells, every Tentacle hit has +15% Crit Rate", () => {
    const [armed] = both({ party: RAPTURE, setup: { gauges: { isadora: 100 } }, play: [{ ultimate: 'isadora' }] }, 'agathe', 'weapon.torn-veil');
    const before = armed.plays[0]!.before;
    const after = armed.state;
    const rate = (state: CombatState, character: string, volley: boolean) =>
      critChance(state, { source: member(state, character).id, owner: member(state, character).id, ...(volley && { volley: true as const }) }, withoutCrit(content))!.rate;
    // Agathe wields it (12 points of her own); Isadora used the Dance.
    expect(rate(before, 'isadora', true)).toBe(0);
    expect(rate(after, 'isadora', true)).toBe(15);
    expect(rate(after, 'agathe', true)).toBe(12 + 15);
    expect(rate(after, 'agathe', false)).toBe(12);
  });

  it("Foxfire Gauntlet: the wielder's damage that consumes Essence is 20% more", () => {
    const [armed, blank] = both({ party: SPIRIT, setup: { resources: { essence: 5 }, gauges: { kibane: 100 } }, play: [{ ultimate: 'kibane' }] }, 'kibane', 'weapon.foxfire-gauntlet');
    const attack = statOf(armed.state, 'kibane', 'attack');
    expect(lost(blank)).toBe(down(2 * attack + 1.6 * attack * 5));
    expect(lost(armed)).toBe(down((2 * attack + 1.6 * attack * 5) * 1.2));
    // A Strike consumes nothing.
    const [strike, strikeBlank] = both({ party: SPIRIT, setup: { hand: ['kibane.strike'] }, play: [{ card: 'kibane.strike', target: 0 }] }, 'kibane', 'weapon.foxfire-gauntlet');
    expect(lost(strike)).toBe(lost(strikeBlank));
  });

  it("Snare-Line: each enemy that skips an action gives the party Shield, 10% of the wielder's HP", () => {
    const [armed, blank] = both(
      { party: UNBOUND, enemies: [HOUND, HOUND], setup: { gauges: { hester: 100 } }, play: [{ ultimate: 'hester' }, { endTurn: true }] },
      'hester',
      'weapon.snare-line',
    );
    const hp = statOf(armed.state, 'hester', 'hp');
    expect(allEvents(armed).filter((e) => e.type === 'controlled')).toHaveLength(2);
    expect(shieldFrom(armed, 'hester')).toEqual([down(0.1 * hp), down(0.1 * hp)]);
    expect(shieldFrom(blank, 'hester')).toEqual([]);
  });
});

describe('Flesh weapons', () => {
  for (const [id, bonus] of [['weapon.surgeons-scalpel', 1.12], ['weapon.suture-hook', 1.06]] as const) {
    it(`${registry.weapons[id]!.name}: Bleed and Poison the wielder applies are ${Math.round((bonus - 1) * 100)}% more`, () => {
      const [cut, cutBlank] = both({ party: FLESH, setup: { hand: ['virelle.suture-cut'] }, play: [{ card: 'virelle.suture-cut', target: 0 }] }, 'virelle', id);
      const attack = statOf(cut.state, 'virelle', 'attack');
      expect(stacksOn(cutBlank, 'status.bleed')).toBe(down(1.5 * attack));
      expect(stacksOn(cut, 'status.bleed')).toBe(down(1.5 * attack * bonus));
      const [pod] = both({ party: FLESH, setup: { hand: ['maelia.swollen-pod'] }, play: [{ card: 'maelia.swollen-pod' }] }, 'maelia', id);
      expect(stacksOn(pod, 'status.poison')).toBe(down(2.67 * statOf(pod.state, 'maelia', 'attack') * bonus));
    });
  }

  for (const [id, share] of [['weapon.womb-glass-lantern', 0.3], ['weapon.pod-sling', 0.15]] as const) {
    it(`${registry.weapons[id]!.name}: the party's first Embryo consumed each turn gives Shield, ${share * 100}% of Defense`, () => {
      // Agathe wields it; Maelia consumes, twice.
      const [armed, blank] = both({ party: FLESH, setup: { hand: ['maelia.strike', 'maelia.strike'], resources: { embryo: 2 } }, play: [{ card: 'maelia.strike', target: 0 }, { card: 'maelia.strike', target: 0 }] }, 'agathe', id);
      expect(shieldFrom(armed, 'agathe')).toEqual([down(share * statOf(armed.state, 'agathe', 'defense'))]);
      expect(shieldFrom(blank, 'agathe')).toEqual([]);
    });
  }
});

describe('Rapture weapons', () => {
  for (const [id, bonus] of [['weapon.bone-rosary', 1.1], ['weapon.wax-candle', 1.05]] as const) {
    it(`${registry.weapons[id]!.name}: every Tentacle hit is ${Math.round((bonus - 1) * 100)}% more, whoever wields it`, () => {
      // Leonora wields it; the hits are the Domain's end-of-turn attack.
      const [armed, blank] = both({ party: RAPTURE, play: [{ endTurn: true }] }, 'leonora', id);
      const start = armed.plays[0]!.before;
      const hit = start.resources.potency!;
      const hits = start.resources.tentacles!;
      expect(hits).toBeGreaterThan(0);
      expect(lost(blank)).toBe(hits * down(hit));
      expect(lost(armed)).toBe(hits * down(hit * bonus));
    });
  }

  for (const [id, share] of [['weapon.procession-bell', 0.3], ['weapon.prayer-rope', 0.15]] as const) {
    it(`${registry.weapons[id]!.name}: the first volley a card triggers each turn gives Shield, ${share * 100}% of Defense`, () => {
      const [armed, blank] = both(
        { party: RAPTURE, setup: { hand: ['isadora.ribbon-lash', 'isadora.ribbon-lash'] }, play: [{ card: 'isadora.ribbon-lash', target: 0 }, { card: 'isadora.ribbon-lash', target: 0 }, { endTurn: true }] },
        'leonora',
        id,
      );
      expect(shieldFrom(armed, 'leonora')).toEqual([down(share * statOf(armed.state, 'leonora', 'defense'))]);
      expect(shieldFrom(blank, 'leonora')).toEqual([]);
    });
  }
});

describe('Spirit weapons', () => {
  for (const [id, bonus] of [['weapon.talisman-fan', 1.1], ['weapon.paper-charm', 1.05]] as const) {
    it(`${registry.weapons[id]!.name}: the wielder's Ritual cards deal ${Math.round((bonus - 1) * 100)}% more`, () => {
      const [armed, blank] = both({ party: SPIRIT, setup: { hand: ['anthe.votive-candle'] }, play: [{ card: 'anthe.votive-candle', target: 0 }] }, 'anthe', id);
      const attack = statOf(armed.state, 'anthe', 'attack');
      expect(lost(blank)).toBe(down(2.67 * attack));
      expect(lost(armed)).toBe(down(2.67 * attack * bonus));
      const [strike, strikeBlank] = both({ party: SPIRIT, setup: { hand: ['anthe.strike'] }, play: [{ card: 'anthe.strike', target: 0 }] }, 'anthe', id);
      expect(lost(strike)).toBe(lost(strikeBlank));
    });
  }

  for (const [id, share] of [['weapon.gold-leaf-lamp', 0.25], ['weapon.temple-bell', 0.12]] as const) {
    it(`${registry.weapons[id]!.name}: ending a turn holding a Ritual gives Shield, ${share * 100}% of Defense`, () => {
      const holding = runScenario({ party: SPIRIT, weapons: { leonora: id }, setup: { hand: ['anthe.votive-candle'] }, play: [{ endTurn: true }] }, content);
      expect(shieldFrom(holding, 'leonora')).toEqual([down(share * statOf(holding.state, 'leonora', 'defense'))]);
      const empty = runScenario({ party: SPIRIT, weapons: { leonora: id }, setup: { hand: ['anthe.strike'] }, play: [{ endTurn: true }] }, content);
      expect(shieldFrom(empty, 'leonora')).toEqual([]);
    });
  }
});

describe('Unbound weapons', () => {
  it('Iron Snare: the wielder deals 10% more to enemies with Weak or Vulnerable', () => {
    const [armed, blank] = both({ party: UNBOUND, setup: { hand: ['hester.weighted-net', 'leonora.strike'] }, play: [{ card: 'hester.weighted-net', target: 0 }, { card: 'leonora.strike', target: 0 }] }, 'leonora', 'weapon.iron-snare');
    const attack = statOf(armed.state, 'leonora', 'attack');
    expect(lost(blank)).toBe(down(2.2 * attack));
    expect(lost(armed)).toBe(down(2.2 * attack * 1.1));
    const [bare, bareBlank] = both({ party: UNBOUND, setup: { hand: ['leonora.strike'] }, play: [{ card: 'leonora.strike', target: 0 }] }, 'leonora', 'weapon.iron-snare');
    expect(lost(bare)).toBe(lost(bareBlank));
  });

  it('Brass Hourglass: a turn that starts with Mana debt gives Shield, 30% of Defense', () => {
    const [armed, blank] = both({ party: UNBOUND, setup: { hand: ['leonora.promissory-note'] }, play: [{ card: 'leonora.promissory-note' }, { endTurn: true }] }, 'leonora', 'weapon.brass-hourglass');
    expect(shieldFrom(armed, 'leonora')).toEqual([down(0.3 * statOf(armed.state, 'leonora', 'defense'))]);
    expect(shieldFrom(blank, 'leonora')).toEqual([]);
  });

  it("Whetstone: the wielder's Strike deals 8% more", () => {
    const [armed, blank] = both({ party: UNBOUND, setup: { hand: ['leonora.strike'] }, play: [{ card: 'leonora.strike', target: 0 }] }, 'leonora', 'weapon.whetstone');
    const attack = statOf(armed.state, 'leonora', 'attack');
    expect(lost(blank)).toBe(down(2.2 * attack));
    expect(lost(armed)).toBe(down(2.2 * attack * 1.08));
    // Other cards' damage is untouched.
    const [cut, cutBlank] = both({ party: FLESH, setup: { hand: ['virelle.suture-cut'] }, play: [{ card: 'virelle.suture-cut', target: 0 }] }, 'virelle', 'weapon.whetstone');
    expect(lost(cut)).toBe(lost(cutBlank));
  });

  it("Tin Compass: the wielder's Defense card gives 6% more Shield", () => {
    const [armed, blank] = both({ party: UNBOUND, setup: { hand: ['leonora.defense'] }, play: [{ card: 'leonora.defense' }] }, 'leonora', 'weapon.tin-compass');
    const defense = statOf(armed.state, 'leonora', 'defense');
    expect(blank.state.party.shield).toBe(down(2.67 * defense));
    expect(armed.state.party.shield).toBe(down(2.67 * defense * 1.06));
    // Other cards' Shield is untouched.
    const [tangle, tangleBlank] = both({ party: UNBOUND, setup: { hand: ['hester.tangle-line'] }, play: [{ card: 'hester.tangle-line' }] }, 'hester', 'weapon.tin-compass');
    expect(tangle.state.party.shield).toBeGreaterThan(0);
    expect(tangle.state.party.shield).toBe(tangleBlank.state.party.shield);
  });
});

it('every weapon has a scenario here', () => {
  const tested = new Set(
    ['seed-orb-staff', 'chalk-circle-censer', 'vigil-lamp', 'sealed-ledger', 'thorn-rapier', 'torn-veil', 'foxfire-gauntlet', 'snare-line', 'surgeons-scalpel', 'suture-hook', 'womb-glass-lantern', 'pod-sling', 'bone-rosary', 'wax-candle', 'procession-bell', 'prayer-rope', 'talisman-fan', 'paper-charm', 'gold-leaf-lamp', 'temple-bell', 'iron-snare', 'brass-hourglass', 'whetstone', 'tin-compass'].map((s) => `weapon.${s}`),
  );
  expect(Object.keys(registry.weapons).sort()).toEqual([...tested].sort());
});
