import { describe, expect, it } from 'vitest';
import { applyStatus, damage, gainShield, heal, ifConsume, loseHp, mul, percentOf, stacks, stat } from '../engine/index.ts';
import { card, character, domain, enemy, relic, status, variant } from './define.ts';
import { registry, validateContent } from './registry.ts';
import { CHARACTER_BANNER } from './banners.ts';
import { ITEM_NAMES } from './items.ts';
import { STARTERS } from './roster.ts';

// A valid character needs one card in each of the five slots.
const strike = card({ id: 'test.strike', name: 'X', owner: 'tester', slot: 'strike', cost: 1, target: 'chosenEnemy', effects: [damage(mul(2, stat('attack')))] });
const slotted = (slot: 'defense' | 'transcend' | 'flavourA' | 'flavourB', cost: number) =>
  card({ id: `test.${slot.toLowerCase()}`, name: 'X', owner: 'tester', slot, cost, target: 'none', effects: [gainShield(stat('defense'))] });
const kit = { strike, defense: slotted('defense', 1), transcend: slotted('transcend', 3), flavourA: slotted('flavourA', 2), flavourB: slotted('flavourB', 2) };
const tester = character({ id: 'tester', name: 'Tester', domain: 'flesh', role: 'hybrid', stats: { hp: 10, attack: 1, defense: 1 }, cards: Object.values(kit) });
const testerModule = { ...kit, tester };
const flesh = domain({ id: 'flesh', name: 'Flesh', resources: [] });
const errorsFor = (extra: Record<string, unknown>) =>
  validateContent({ './characters/tester.ts': testerModule, './domains/flesh.ts': { flesh }, './cards/broken.ts': extra }).errors;

describe('content registry', () => {
  it('the shipped content validates', () => {
    // The starter four and the banner four (M5.2).
    expect(Object.keys(registry.characters).sort()).toEqual(['agathe', 'anthe', 'hester', 'isadora', 'kibane', 'leonora', 'maelia', 'virelle']);
    expect(registry.enemies['enemy.training-dummy']).toBeDefined();
    expect(Object.keys(registry.domains).sort()).toEqual(['flesh', 'rapture', 'spirit', 'unbound']);
  });

  it('the character banner pools the banner four, never a starter, and every item it gives has a name', () => {
    expect([...CHARACTER_BANNER.pool].sort()).toEqual(['hester', 'isadora', 'kibane', 'virelle']);
    expect(CHARACTER_BANNER.pool.filter((id) => !registry.characters[id] || STARTERS.includes(id))).toEqual([]);
    // One material per Domain: the one its characters ascend with.
    expect([...CHARACTER_BANNER.sr.one].sort()).toEqual(Object.values(registry.domains).map((d) => d.material).sort());
    expect(Object.values(registry.domains).filter((d) => !d.material || !ITEM_NAMES[d.material])).toEqual([]);
    expect([...CHARACTER_BANNER.sr.one, ...Object.keys(CHARACTER_BANNER.r), 'pollen'].filter((item) => !ITEM_NAMES[item])).toEqual([]);
  });

  it('the starters are four characters, one per Domain', () => {
    expect(STARTERS.map((id) => registry.characters[id]?.domain).sort()).toEqual(['flesh', 'rapture', 'spirit', 'unbound']);
  });

  it('reports a character whose Domain has no module', () => {
    expect(validateContent({ './characters/tester.ts': testerModule }).errors).toEqual([
      'src/content/characters/tester.ts › tester: domain "flesh" is not defined',
    ]);
  });

  it('a valid fixture has no errors', () => {
    expect(validateContent({ './characters/tester.ts': testerModule, './domains/flesh.ts': { flesh } }).errors).toEqual([]);
  });

  it('reports a character without exactly one card in each of the five slots', () => {
    const short = character({ id: 'tester', name: 'Tester', domain: 'flesh', role: 'hybrid', stats: { hp: 10, attack: 1, defense: 1 }, cards: [strike] });
    expect(validateContent({ './characters/tester.ts': { strike, tester: short }, './domains/flesh.ts': { flesh } }).errors).toEqual([
      'src/content/characters/tester.ts › tester: needs exactly one card in each slot (strike, defense, transcend, flavourA, flavourB)',
    ]);
  });

  it("the party's own cards (Symptoms) have no owner, so no personal slot", () => {
    const loose = card({ id: 'test.loose', name: 'X', cost: 0, target: 'none', effects: [gainShield(stat('defense'))] });
    const slottedLoose = card({ ...loose, id: 'test.slotted-loose', slot: 'strike', cost: 1 });
    expect(errorsFor({ loose, slottedLoose })).toEqual([
      'src/content/cards/broken.ts › test.slotted-loose: a card without an owner has no personal slot and is not generated',
    ]);
  });

  it("card rewards: a character's own sit outside her five cards; a Domain's generic card has a Domain and no owner", () => {
    const own = card({ id: 'test.own', name: 'X', owner: 'tester', reward: true, cost: 1, target: 'none', effects: [gainShield(stat('defense'))] });
    const generic = card({ id: 'test.generic', name: 'X', domain: 'flesh', reward: true, cost: 1, target: 'none', effects: [gainShield(stat('defense'))] });
    expect(errorsFor({ own, generic })).toEqual([]);
    const slotted = card({ ...own, id: 'test.slotted', slot: 'flavourA', cost: 2 });
    const owned = card({ id: 'test.owned', name: 'X', domain: 'flesh', owner: 'tester', reward: true, cost: 1, target: 'none', effects: [gainShield(stat('defense'))] });
    const unrewarded = card({ id: 'test.unrewarded', name: 'X', domain: 'flesh', cost: 1, target: 'none', effects: [gainShield(stat('defense'))] });
    const nowhere = card({ id: 'test.nowhere', name: 'X', domain: 'tides', reward: true, cost: 1, target: 'none', effects: [gainShield(stat('defense'))] });
    const loose = card({ id: 'test.loose', name: 'X', reward: true, cost: 1, target: 'none', effects: [gainShield(stat('defense'))] });
    expect(errorsFor({ slotted, owned, unrewarded, nowhere, loose })).toEqual([
      'src/content/cards/broken.ts › test.slotted: a card reward has no personal slot and is not generated',
      "src/content/cards/broken.ts › test.owned: a Domain's generic card has no owner or personal slot and is not generated",
      "src/content/cards/broken.ts › test.unrewarded: a Domain's generic card must be a card reward",
      'src/content/cards/broken.ts › test.nowhere: domain "tides" is not defined',
      'src/content/cards/broken.ts › test.loose: a card reward needs an owner or a Domain',
    ]);
  });

  it("dupe levels: a variant takes one of her cards' place, dealt by her dupe, in the same slot; a dupe swaps only her cards for their variants", () => {
    // A variant may leave its slot's cost band (Weighted Net costs 1 at C3).
    const cheap = variant(kit.flavourA, 3, { cost: 1 });
    const dupes = (cards: Record<string, string>, modifiers = {}) =>
      character({ ...tester, cards: Object.values(kit), dupes: [{ text: 'C1', cards, passive: { name: 'P', scope: 'combat', text: 'P.', ...modifiers } }] });
    const ok = validateContent({ './characters/tester.ts': { ...kit, cheap, tester: dupes({ [kit.flavourA.id]: cheap.id }) }, './domains/flesh.ts': { flesh } });
    expect(ok.errors).toEqual([]);
    const orphan = variant(kit.flavourB, 3, {});
    const moved = variant(kit.flavourA, 4, { slot: 'flavourB' });
    const stranger = card({ ...cheap, id: 'test.stranger', variantOf: 'test.nothing' });
    const wrong = dupes(
      { [kit.flavourA.id]: cheap.id, 'test.nothing': cheap.id, [kit.defense.id]: kit.flavourB.id },
      { modifiers: [{ value: 'stacks', step: 'flat', amount: 1, status: 'status.missing' }] },
    );
    expect(validateContent({ './characters/tester.ts': { ...kit, cheap, orphan, moved, stranger, tester: wrong }, './domains/flesh.ts': { flesh } }).errors).toEqual([
      'src/content/characters/tester.ts › test.flavourb-c3: no dupe level of tester deals it',
      'src/content/characters/tester.ts › test.flavoura-c4: a variant keeps the slot of "test.flavoura"',
      'src/content/characters/tester.ts › test.flavoura-c4: no dupe level of tester deals it',
      `src/content/characters/tester.ts › test.stranger: variantOf "test.nothing" is not one of tester's cards`,
      'src/content/characters/tester.ts › test.stranger: no dupe level of tester deals it',
      'src/content/characters/tester.ts › tester: dupes[0].passive.modifiers[0]: unknown status "status.missing"',
      `src/content/characters/tester.ts › tester: dupes[0].cards: "test.nothing" is not one of tester's cards`,
      'src/content/characters/tester.ts › tester: dupes[0].cards: "test.flavoura-c3" is not a variant of "test.nothing"',
      'src/content/characters/tester.ts › tester: dupes[0].cards: "test.flavourb" is not a variant of "test.defense"',
    ]);
  });

  it('a card pointing at a missing status fails with its file and ID', () => {
    const broken = card({
      id: 'test.broken', name: 'X', owner: 'tester', cost: 1, target: 'chosenEnemy',
      effects: [damage(stat('attack')), applyStatus({ id: 'status.missing' }, 2)],
    });
    expect(errorsFor({ broken })).toContain(
      'src/content/cards/broken.ts › test.broken: effects[1]: unknown status "status.missing"',
    );
  });

  it('checks references inside control-flow branches', () => {
    const nested = card({
      id: 'test.nested', name: 'X', owner: 'tester', cost: 0, target: 'chosenEnemy',
      effects: [ifConsume('embryo', 1, [applyStatus({ id: 'status.nope' }, 1)])],
    });
    expect(errorsFor({ nested }).join('\n')).toMatch(/test\.nested: effects\[0\]\.branch\[0\]: unknown status "status\.nope"/);
  });

  // Stats are the multiplier (docs/notes/m6-scaling.md, 4.1; owner, 31 Oct).
  it("party content's damage, Shield, damage stacks and heals must read a stat; a bare number fails with its file and ID", () => {
    const bleed = status({ id: 'status.bleed', stacking: 'add', triggers: [{ on: 'statusTick', do: [loseHp(stacks('status.bleed'))] }] });
    const weak = status({ id: 'status.weak', stacking: 'add', lasts: 'ownTurns' });
    const flat = card({
      id: 'test.flat', name: 'X', owner: 'tester', cost: 1, target: 'chosenEnemy',
      effects: [damage(6), gainShield(5), applyStatus(bleed, 6), heal(3), applyStatus(weak, 1)],
    });
    const charm = relic({ id: 'relic.charm', name: 'Charm', tier: 'common', text: 'X', triggers: [{ on: 'turnStart', do: [gainShield(4)] }] });
    // Enemies scale by level instead, and turn-count statuses (Weak) are counts, not damage.
    const biter = enemy({ id: 'enemy.biter', name: 'Biter', hp: 10, intents: [{ id: 'bite', name: 'Bite', effects: [damage(5, { target: 'party' }), applyStatus(bleed, 3)] }] });
    const errors = errorsFor({ bleed, weak, flat, charm, biter });
    expect(errors.filter((e) => /must be a (ratio|share)/.test(e))).toEqual([
      'src/content/cards/broken.ts › test.flat: effects[0]: damage must be a ratio of a stat, not a bare number',
      'src/content/cards/broken.ts › test.flat: effects[1]: gainShield must be a ratio of a stat, not a bare number',
      'src/content/cards/broken.ts › test.flat: effects[2]: status.bleed stacks must be a ratio of a stat, not a bare number',
      "src/content/cards/broken.ts › test.flat: effects[3]: heal must be a share of the party's max HP",
      'src/content/cards/broken.ts › relic.charm: triggers[0].do[0]: gainShield must be a ratio of a stat, not a bare number',
    ]);
    const ratios = card({
      id: 'test.ratios', name: 'X', owner: 'tester', cost: 1, target: 'chosenEnemy',
      effects: [damage(mul(2, stat('attack'))), gainShield(stat('defense')), applyStatus(bleed, mul(1.5, stat('attack'))), heal(percentOf(2, 'maxHp'))],
    });
    expect(errorsFor({ bleed, ratios }).filter((e) => /must be a (ratio|share)/.test(e))).toEqual([]);
  });

  it('accepts a status that exists', () => {
    const bleed = status({ id: 'status.bleed', stacking: 'add' });
    const ok = card({ id: 'test.ok', name: 'X', owner: 'tester', cost: 0, target: 'chosenEnemy', effects: [applyStatus(bleed, 1)] });
    expect(errorsFor({ bleed, ok }).filter((e) => e.includes('unknown status'))).toEqual([]);
  });

  it('reports unknown operations, bad arguments, owners, cost bands and duplicates', () => {
    const errors = errorsFor({
      unknownOp: card({ id: 'test.a', name: 'X', owner: 'tester', cost: 1, target: 'none', effects: [{ op: 'explode' }] }),
      badArgs: card({ id: 'test.b', name: 'X', owner: 'tester', cost: 1, target: 'none', effects: [{ op: 'gainShield', amount: 'lots' }] }),
      orphan: card({ id: 'test.c', name: 'X', owner: 'nobody', cost: 1, target: 'none', effects: [gainShield(stat('defense'))] }),
      pricey: card({ id: 'test.strike', name: 'X', owner: 'tester', slot: 'strike', cost: 3, target: 'none', effects: [gainShield(stat('defense'))] }),
    }).join('\n');
    expect(errors).toMatch(/test\.a: effects\[0\]: unknown operation "explode"/);
    expect(errors).toMatch(/test\.b: effects\[0\]\.amount: /);
    expect(errors).toMatch(/test\.c: owner "nobody" is not a character/);
    expect(errors).toMatch(/broken\.ts › test\.strike: duplicate card ID \(also in src\/content\/characters\/tester\.ts\)/);
  });

  it('reports a slot cost outside its band', () => {
    const transcend = card({ id: 'test.t', name: 'X', owner: 'tester', slot: 'transcend', cost: 2, target: 'none', effects: [gainShield(stat('defense'))] });
    const t = character({ id: 'tester', name: 'Tester', domain: 'flesh', role: 'hybrid', stats: { hp: 10, attack: 1, defense: 1 }, cards: [...Object.values(kit).filter((c) => c.slot !== 'transcend'), transcend] });
    const { transcend: _, ...rest } = kit;
    expect(validateContent({ './characters/t.ts': { ...rest, transcend, t }, './domains/flesh.ts': { flesh } }).errors).toEqual([
      'src/content/characters/t.ts › test.t: transcend cost 2 is outside 3–5',
    ]);
  });

  it('reports a text slot that does not point at a formula', () => {
    const texty = card({
      id: 'test.texty', name: 'X', owner: 'tester', cost: 0, target: 'none', effects: [gainShield(stat('defense'))],
      text: 'Gain {effects.0.amount} Shield, {effects.0.op}.',
    });
    expect(errorsFor({ texty })).toContain('src/content/cards/broken.ts › test.texty: text: slot {effects.0.op} is not a formula');
  });
});
