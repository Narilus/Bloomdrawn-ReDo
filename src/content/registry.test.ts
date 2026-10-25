import { describe, expect, it } from 'vitest';
import { applyStatus, damage, gainShield, ifConsume } from '../engine/index.ts';
import { card, character, domain, status } from './define.ts';
import { registry, validateContent } from './registry.ts';
import { STARTERS } from './roster.ts';

// A valid character needs one card in each of the five slots.
const strike = card({ id: 'test.strike', name: 'X', owner: 'tester', slot: 'strike', cost: 1, target: 'chosenEnemy', effects: [damage(6)] });
const slotted = (slot: 'defense' | 'transcend' | 'flavourA' | 'flavourB', cost: number) =>
  card({ id: `test.${slot.toLowerCase()}`, name: 'X', owner: 'tester', slot, cost, target: 'none', effects: [gainShield(1)] });
const kit = { strike, defense: slotted('defense', 1), transcend: slotted('transcend', 3), flavourA: slotted('flavourA', 2), flavourB: slotted('flavourB', 2) };
const tester = character({ id: 'tester', name: 'Tester', domain: 'flesh', stats: { hp: 10, attack: 1, defense: 1 }, cards: Object.values(kit) });
const testerModule = { ...kit, tester };
const flesh = domain({ id: 'flesh', name: 'Flesh', resources: [] });
const errorsFor = (extra: Record<string, unknown>) =>
  validateContent({ './characters/tester.ts': testerModule, './domains/flesh.ts': { flesh }, './cards/broken.ts': extra }).errors;

describe('content registry', () => {
  it('the shipped content validates', () => {
    // Virelle's and Kibane's M0 placeholders left with the five-card check; their kits come in M5.
    expect(Object.keys(registry.characters).sort()).toEqual(['agathe', 'anthe', 'leonora', 'maelia']);
    expect(registry.enemies['enemy.training-dummy']).toBeDefined();
    expect(Object.keys(registry.domains).sort()).toEqual(['flesh', 'rapture', 'spirit', 'unbound']);
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
    const short = character({ id: 'tester', name: 'Tester', domain: 'flesh', stats: { hp: 10, attack: 1, defense: 1 }, cards: [strike] });
    expect(validateContent({ './characters/tester.ts': { strike, tester: short }, './domains/flesh.ts': { flesh } }).errors).toEqual([
      'src/content/characters/tester.ts › tester: needs exactly one card in each slot (strike, defense, transcend, flavourA, flavourB)',
    ]);
  });

  it("the party's own cards (Symptoms) have no owner, so no personal slot", () => {
    const loose = card({ id: 'test.loose', name: 'X', cost: 0, target: 'none', effects: [gainShield(1)] });
    const slottedLoose = card({ ...loose, id: 'test.slotted-loose', slot: 'strike', cost: 1 });
    expect(errorsFor({ loose, slottedLoose })).toEqual([
      'src/content/cards/broken.ts › test.slotted-loose: a card without an owner has no personal slot and is not generated',
    ]);
  });

  it("card rewards: a character's own sit outside her five cards; a Domain's generic card has a Domain and no owner", () => {
    const own = card({ id: 'test.own', name: 'X', owner: 'tester', reward: true, cost: 1, target: 'none', effects: [gainShield(1)] });
    const generic = card({ id: 'test.generic', name: 'X', domain: 'flesh', reward: true, cost: 1, target: 'none', effects: [gainShield(1)] });
    expect(errorsFor({ own, generic })).toEqual([]);
    const slotted = card({ ...own, id: 'test.slotted', slot: 'flavourA', cost: 2 });
    const owned = card({ id: 'test.owned', name: 'X', domain: 'flesh', owner: 'tester', reward: true, cost: 1, target: 'none', effects: [gainShield(1)] });
    const unrewarded = card({ id: 'test.unrewarded', name: 'X', domain: 'flesh', cost: 1, target: 'none', effects: [gainShield(1)] });
    const nowhere = card({ id: 'test.nowhere', name: 'X', domain: 'tides', reward: true, cost: 1, target: 'none', effects: [gainShield(1)] });
    const loose = card({ id: 'test.loose', name: 'X', reward: true, cost: 1, target: 'none', effects: [gainShield(1)] });
    expect(errorsFor({ slotted, owned, unrewarded, nowhere, loose })).toEqual([
      'src/content/cards/broken.ts › test.slotted: a card reward has no personal slot and is not generated',
      "src/content/cards/broken.ts › test.owned: a Domain's generic card has no owner or personal slot and is not generated",
      "src/content/cards/broken.ts › test.unrewarded: a Domain's generic card must be a card reward",
      'src/content/cards/broken.ts › test.nowhere: domain "tides" is not defined',
      'src/content/cards/broken.ts › test.loose: a card reward needs an owner or a Domain',
    ]);
  });

  it('a card pointing at a missing status fails with its file and ID', () => {
    const broken = card({
      id: 'test.broken', name: 'X', owner: 'tester', cost: 1, target: 'chosenEnemy',
      effects: [damage(1), applyStatus({ id: 'status.missing' }, 2)],
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

  it('accepts a status that exists', () => {
    const bleed = status({ id: 'status.bleed', stacking: 'add' });
    const ok = card({ id: 'test.ok', name: 'X', owner: 'tester', cost: 0, target: 'chosenEnemy', effects: [applyStatus(bleed, 1)] });
    expect(errorsFor({ bleed, ok }).filter((e) => e.includes('unknown status'))).toEqual([]);
  });

  it('reports unknown operations, bad arguments, owners, cost bands and duplicates', () => {
    const errors = errorsFor({
      unknownOp: card({ id: 'test.a', name: 'X', owner: 'tester', cost: 1, target: 'none', effects: [{ op: 'explode' }] }),
      badArgs: card({ id: 'test.b', name: 'X', owner: 'tester', cost: 1, target: 'none', effects: [{ op: 'gainShield', amount: 'lots' }] }),
      orphan: card({ id: 'test.c', name: 'X', owner: 'nobody', cost: 1, target: 'none', effects: [gainShield(1)] }),
      pricey: card({ id: 'test.strike', name: 'X', owner: 'tester', slot: 'strike', cost: 3, target: 'none', effects: [gainShield(1)] }),
    }).join('\n');
    expect(errors).toMatch(/test\.a: effects\[0\]: unknown operation "explode"/);
    expect(errors).toMatch(/test\.b: effects\[0\]\.amount: /);
    expect(errors).toMatch(/test\.c: owner "nobody" is not a character/);
    expect(errors).toMatch(/broken\.ts › test\.strike: duplicate card ID \(also in src\/content\/characters\/tester\.ts\)/);
  });

  it('reports a slot cost outside its band', () => {
    const transcend = card({ id: 'test.t', name: 'X', owner: 'tester', slot: 'transcend', cost: 2, target: 'none', effects: [gainShield(1)] });
    const t = character({ id: 'tester', name: 'Tester', domain: 'flesh', stats: { hp: 10, attack: 1, defense: 1 }, cards: [...Object.values(kit).filter((c) => c.slot !== 'transcend'), transcend] });
    const { transcend: _, ...rest } = kit;
    expect(validateContent({ './characters/t.ts': { ...rest, transcend, t }, './domains/flesh.ts': { flesh } }).errors).toEqual([
      'src/content/characters/t.ts › test.t: transcend cost 2 is outside 3–5',
    ]);
  });

  it('reports a text slot that does not point at a formula', () => {
    const texty = card({
      id: 'test.texty', name: 'X', owner: 'tester', cost: 0, target: 'none', effects: [gainShield(1)],
      text: 'Gain {effects.0.amount} Shield, {effects.0.op}.',
    });
    expect(errorsFor({ texty })).toContain('src/content/cards/broken.ts › test.texty: text: slot {effects.0.op} is not a formula');
  });
});
