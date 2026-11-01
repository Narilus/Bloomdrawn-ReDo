import { describe, expect, it } from 'vitest';
import { NEW_PROFILE, type Profile } from './profile.ts';
import { PROFILE_EXP } from './profileLevel.ts';
import { endTrial, TRIAL_TIERS, trialCleared, trialFight, trialOpen } from './trials.ts';

// Trials (docs/notes/m6-depth.md, "Trials"; owner, 31 Oct).

const MAT = 'material.flesh';
function win(profile: Profile, tier: number, domain = 'flesh') {
  const result = endTrial(profile, domain, MAT, tier, true);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

describe('Trials', () => {
  it('five tiers at levels 10 to 50, paying 1, 2, 3, 3 and 6 of the material, with 1 Bloom for each first clear and 3 for Tier 5', () => {
    expect(TRIAL_TIERS.map((t) => [t.level, t.pay, t.firstClear])).toEqual([[10, 1, 1], [20, 2, 1], [30, 3, 1], [40, 3, 1], [50, 6, 3]]);
  });

  it('Tier 1 is open to a new profile, and each win opens the next, Domain by Domain', () => {
    expect([trialCleared(NEW_PROFILE, 'flesh'), trialOpen(NEW_PROFILE, 'flesh')]).toEqual([0, 1]);
    expect(endTrial(NEW_PROFILE, 'flesh', MAT, 2, true)).toEqual({ ok: false, reason: 'Win Tier 1 first.' });
    expect(endTrial(NEW_PROFILE, 'flesh', MAT, 6, true)).toEqual({ ok: false, reason: 'There is no Tier 6.' });
    const one = win(NEW_PROFILE, 1).profile;
    expect([trialOpen(one, 'flesh'), trialOpen(one, 'spirit')]).toEqual([2, 1]);
    const all = [1, 2, 3, 4, 5].reduce((p, tier) => win(p, tier).profile, NEW_PROFILE);
    expect([trialCleared(all, 'flesh'), trialOpen(all, 'flesh')]).toEqual([5, 5]);
  });

  it('a first clear pays the material, its Blooms and both EXP; a repeat pays the material and the win EXP only', () => {
    const first = win(NEW_PROFILE, 1);
    expect(first).toMatchObject({ won: true, material: 1, pulls: 1, first: true });
    expect(first.profile).toEqual({
      ...NEW_PROFILE,
      pulls: NEW_PROFILE.pulls + 1,
      items: { [MAT]: 1 },
      trials: { flesh: 1 },
      stats: { trials: 1 },
      exp: PROFILE_EXP.trial + PROFILE_EXP.firstTrial,
    });
    const again = win(first.profile, 1);
    expect(again).toMatchObject({ material: 1, pulls: 0, first: false });
    expect(again.profile).toMatchObject({ pulls: first.profile.pulls, items: { [MAT]: 2 }, trials: { flesh: 1 }, stats: { trials: 2 }, exp: first.profile.exp! + PROFILE_EXP.trial });
  });

  it('Tier 5 pays enough to ascend two characters at 30, and 3 Blooms the first time', () => {
    const four = [1, 2, 3, 4].reduce((p, tier) => win(p, tier).profile, NEW_PROFILE);
    const five = win(four, 5);
    expect([five.material, five.pulls, (five.profile.items?.[MAT] ?? 0) - (four.items?.[MAT] ?? 0)]).toEqual([6, 3, 6]);
  });

  it('a defeat pays nothing and changes nothing', () => {
    const lost = endTrial(NEW_PROFILE, 'flesh', MAT, 1, false);
    expect(lost).toEqual({ ok: true, profile: NEW_PROFILE, won: false, material: 0, pulls: 0, first: false });
  });

  it("a Trial's fight is the party at its own growth, fresh, against the boss at the tier's level", () => {
    const growth = { levels: { agathe: 20 }, ascensions: { agathe: 1 }, dupes: { kibane: 2 } };
    expect(trialFight(7, ['agathe', 'kibane'], growth, ['enemy.boss'], 2)).toEqual({
      seed: 7, party: ['agathe', 'kibane'], enemies: ['enemy.boss'], enemyLevel: 20, levels: [20, 1], ascensions: [1, 0], dupes: [0, 2],
    });
    expect(trialFight(7, ['agathe'], {}, ['enemy.boss'], 5)).toEqual({ seed: 7, party: ['agathe'], enemies: ['enemy.boss'], enemyLevel: 50 });
    expect(() => trialFight(7, ['agathe'], {}, ['enemy.boss'], 6)).toThrow('There is no Tier 6.');
  });
});
