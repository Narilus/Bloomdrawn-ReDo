import { describe, expect, it } from 'vitest';
import { buyPreset, NEW_PROFILE, ownedCharacters, partyProblem, placeInTeam, presetCost, quickTeam, removeFromTeam, renameTeam, teamsOf } from './profile.ts';

// Party select (docs/notes/m5-collection.md; owner, 26 Oct): any four owned characters, in order, kept in team presets.

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

  it('a place left empty is not a party', () => {
    expect(partyProblem(['a', null, 'c', 'd'], STARTERS)).toBe('A party is 4 characters.');
  });

  it('a profile that never saved presets has five, with the first four owned in Team 1', () => {
    expect(teamsOf(NEW_PROFILE, [...STARTERS, 'e'])).toEqual([
      { name: 'Team 1', members: STARTERS },
      { name: 'Team 2', members: [null, null, null, null] },
      { name: 'Team 3', members: [null, null, null, null] },
      { name: 'Team 4', members: [null, null, null, null] },
      { name: 'Team 5', members: [null, null, null, null] },
    ]);
    expect(teamsOf(NEW_PROFILE, ['a', 'b'])[0]!.members).toEqual(['a', 'b', null, null]);
    const saved = [{ name: 'Bleeders', members: ['d', null, 'a', null] }];
    expect(teamsOf({ ...NEW_PROFILE, teams: saved }, STARTERS)).toEqual(saved);
  });

  it('a character picked for a place goes in; one already in the team swaps places with whoever is there', () => {
    expect(placeInTeam(['a', 'b', null, null], 2, 'e')).toEqual(['a', 'b', 'e', null]);
    expect(placeInTeam(['a', 'b', 'c', 'd'], 0, 'e')).toEqual(['e', 'b', 'c', 'd']);
    expect(placeInTeam(['a', 'b', 'c', 'd'], 0, 'b')).toEqual(['b', 'a', 'c', 'd']);
    expect(placeInTeam(['a', 'b', null, 'd'], 2, 'a')).toEqual([null, 'b', 'a', 'd']);
    expect(placeInTeam(['a', 'b', 'c', 'd'], 1, 'b')).toEqual(['a', 'b', 'c', 'd']);
    expect(removeFromTeam(['a', 'b', 'c', 'd'], 1)).toEqual(['a', null, 'c', 'd']);
  });

  it('quick select fills the places front first in the order clicked', () => {
    expect(quickTeam(['c', 'a', 'd', 'b'])).toEqual(['c', 'a', 'd', 'b']);
    expect(quickTeam(['c'])).toEqual(['c', null, null, null]);
  });

  it('a team name is trimmed and cut to length; a blank one goes back to the default', () => {
    expect(renameTeam('  Bleeders ', 0)).toBe('Bleeders');
    expect(renameTeam('x'.repeat(30), 0)).toBe('x'.repeat(24));
    expect(renameTeam('   ', 2)).toBe('Team 3');
  });

  it('one more preset costs 500 Ducats and each after it 250 more; bought, it is empty and chosen (owner, 29 Oct)', () => {
    const rich = { ...NEW_PROFILE, items: { money: 1250, pollen: 3 } };
    expect(presetCost(rich)).toBe(500);
    const sixth = buyPreset(rich, STARTERS);
    if (!sixth.ok) throw new Error(sixth.reason);
    expect(sixth.profile.teams).toEqual([...teamsOf(rich, STARTERS), { name: 'Team 6', members: [null, null, null, null] }]);
    expect([sixth.profile.team, sixth.profile.items, presetCost(sixth.profile)]).toEqual([5, { money: 750, pollen: 3 }, 750]);
    const seventh = buyPreset(sixth.profile, STARTERS);
    if (!seventh.ok) throw new Error(seventh.reason);
    // All the Ducats spent leaves none.
    expect([seventh.profile.teams?.length, seventh.profile.items, presetCost(seventh.profile)]).toEqual([7, { pollen: 3 }, 1000]);
    expect(buyPreset(seventh.profile, STARTERS)).toEqual({ ok: false, reason: 'This needs 1000 Ducats.' });
  });
});
