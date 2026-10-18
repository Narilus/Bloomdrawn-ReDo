import { describe, expect, it } from 'vitest';
import { applyStatus, damage, gainShield, ifConsume } from '../engine/index.ts';
import { card, character, domain, status } from './define.ts';
import { registry, validateContent } from './registry.ts';

const strike = card({ id: 'test.strike', name: 'X', owner: 'tester', slot: 'strike', cost: 1, target: 'chosenEnemy', effects: [damage(6)] });
const tester = character({ id: 'tester', name: 'Tester', domain: 'flesh', stats: { hp: 10, attack: 1, defense: 1 }, cards: [strike] });
const flesh = domain({ id: 'flesh', name: 'Flesh', resources: [] });
const errorsFor = (extra: Record<string, unknown>) =>
  validateContent({ './characters/tester.ts': { strike, tester }, './domains/flesh.ts': { flesh }, './cards/broken.ts': extra }).errors;

describe('content registry', () => {
  it('the shipped content validates', () => {
    expect(Object.keys(registry.characters).sort()).toEqual(['agathe', 'anthe', 'kibane', 'leonora', 'maelia', 'virelle']);
    expect(registry.enemies['enemy.training-dummy']).toBeDefined();
    expect(Object.keys(registry.domains).sort()).toEqual(['flesh', 'rapture', 'spirit', 'unbound']);
  });

  it('reports a character whose Domain has no module', () => {
    expect(validateContent({ './characters/tester.ts': { strike, tester } }).errors).toEqual([
      'src/content/characters/tester.ts › tester: domain "flesh" is not defined',
    ]);
  });

  it('a valid fixture has no errors', () => {
    expect(validateContent({ './characters/tester.ts': { strike, tester }, './domains/flesh.ts': { flesh } }).errors).toEqual([]);
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
    const t = character({ id: 'tester', name: 'Tester', domain: 'flesh', stats: { hp: 10, attack: 1, defense: 1 }, cards: [transcend] });
    expect(validateContent({ './characters/t.ts': { transcend, t }, './domains/flesh.ts': { flesh } }).errors).toEqual([
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
