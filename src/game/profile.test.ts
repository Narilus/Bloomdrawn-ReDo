import { describe, expect, it } from 'vitest';
import { defaultParty, NEW_PROFILE, ownedCharacters, partyProblem } from './profile.ts';

// Party select (docs/notes/m5-collection.md): any four owned characters, in order.

const STARTERS = ['a', 'b', 'c', 'd'];

describe('the roster and party select', () => {
  it('every profile owns the starters, then the characters it has gained, each once', () => {
    expect(ownedCharacters(NEW_PROFILE, STARTERS)).toEqual(STARTERS);
    expect(ownedCharacters({ ...NEW_PROFILE, owned: ['e', 'b'] }, STARTERS)).toEqual([...STARTERS, 'e']);
  });

  it('any four different owned characters make a party, in any order', () => {
    const owned = [...STARTERS, 'e'];
    expect(partyProblem(['e', 'c', 'a', 'd'], owned)).toBeUndefined();
    expect(partyProblem(['d', 'c', 'b', 'a'], owned)).toBeUndefined();
  });

  it('rejects a party that is not four, repeats a character, or has one not owned', () => {
    expect(partyProblem(['a', 'b', 'c'], STARTERS)).toBe('A party is 4 characters.');
    expect(partyProblem(['a', 'b', 'c', 'd', 'a'], STARTERS)).toBe('A party is 4 characters.');
    expect(partyProblem(['a', 'b', 'c', 'c'], STARTERS)).toBe('A character can be in the party only once.');
    expect(partyProblem(['a', 'b', 'c', 'e'], STARTERS)).toBe("The party has a character you don't own.");
  });

  it('party select offers the last party if it still works, else the first four owned', () => {
    expect(defaultParty(NEW_PROFILE, STARTERS)).toEqual(STARTERS);
    expect(defaultParty({ ...NEW_PROFILE, party: ['d', 'c', 'b', 'a'] }, STARTERS)).toEqual(['d', 'c', 'b', 'a']);
    expect(defaultParty({ ...NEW_PROFILE, party: ['e', 'c', 'b', 'a'] }, STARTERS)).toEqual(STARTERS);
  });
});
