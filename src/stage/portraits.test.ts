import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import { portraitArt } from './art.ts';

describe('portraits (M6.11)', () => {
  it('each portrait file is named after a playable character, so a typo never leaves her ring blank', () => {
    expect(Object.keys(portraitArt).filter((id) => registry.characters[id] === undefined)).toEqual([]);
  });

  it('every character has her portrait (M6.11)', () => {
    expect(Object.keys(registry.characters).filter((id) => portraitArt[id] === undefined)).toEqual([]);
  });
});
