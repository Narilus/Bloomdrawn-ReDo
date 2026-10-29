import { z } from 'zod';
import { ASCENSIONS, levelCap, MAX_LEVEL } from '../game/levels.ts';
import { emptyTeam, PARTY_SIZE, TEAM_NAME_LENGTH, TEAM_PRESETS, type Profile } from '../game/profile.ts';
import type { SaveKind } from './store.ts';

const id = z.string().min(1);
const count = z.int().nonnegative();
const items = z.record(id, count);

const pullRecord = z.strictObject({
  n: z.int().positive(),
  banner: id,
  rarity: z.enum(['ssr', 'sr', 'r']),
  character: id.optional(),
  items,
  dupe: z.union([z.literal('new'), z.literal('overflow'), z.int().positive()]).optional(),
  focus: id.optional(),
  fiftyFifty: z.enum(['won', 'lost', 'guaranteed']).optional(),
  guarantee: z.enum(['pity', 'tenPull']).optional(),
  pityBefore: count,
  pityAfter: count,
  lossesBefore: count,
  lossesAfter: count,
  bloomsBefore: count,
  bloomsAfter: count,
});

const profileSchema = z.strictObject({
  pulls: z.int().nonnegative(),
  runs: z.int().nonnegative(),
  owned: z.array(id),
  dupes: z.record(id, z.int().positive()).optional(),
  levels: z.record(id, z.int().min(2).max(MAX_LEVEL)).optional(),
  ascensions: z.record(id, z.int().min(1).max(ASCENSIONS.length)).optional(),
  items: items.optional(),
  focus: id.optional(),
  gacha: z.strictObject({ stream: z.int().nonnegative(), pity: z.record(id, count), losses: z.record(id, count), history: z.array(pullRecord) }).optional(),
  teams: z.array(z.strictObject({ name: z.string().min(1).max(TEAM_NAME_LENGTH), members: z.array(id.nullable()).length(PARTY_SIZE) })).min(1).optional(),
  team: z.int().nonnegative().optional(),
  run: z.strictObject({ id, elites: z.int().nonnegative() }).optional(),
});

/**
 * The profile save (docs/notes/m4-run.md, m5-collection.md): banked pulls, a run count, the characters
 * gained and their dupes, levels and ascensions, items, the Focus and the gacha, the team presets and
 * the run in progress's tally.
 */
export const profileSave: SaveKind<Profile> = {
  key: 'profile',
  schemaVersion: 7,
  migrations: {
    // v2 added the run in progress, which a v1 profile never has.
    1: (data) => data,
    // v3 added the characters gained (none before M5; the starters are always owned) and the last party.
    2: (data) => ({ ...(data as object), owned: [] }),
    // v4 replaced the last party with team presets: the last party becomes Team 1.
    3: (data) => {
      const { party, ...rest } = data as { party?: string[] };
      if (!party) return rest;
      const teams = Array.from({ length: TEAM_PRESETS }, (_, i) => emptyTeam(i));
      teams[0]!.members = party;
      return { ...rest, teams, team: 0 };
    },
    // v5 added dupes, items and the gacha, which a v4 profile has none of.
    4: (data) => data,
    // v6 replaced the Standard banner with the character banner and its Focus (owner, 28 Oct): pity
    // counted on the Standard banner carries over, and no 50/50 has been lost. The Standard pulls had
    // no Focus and no 50/50, so their records gain only a loss count of 0.
    5: (data) => {
      const profile = data as { gacha?: { pity: Record<string, number>; history: object[] } };
      if (!profile.gacha) return data;
      const { standard, ...pity } = profile.gacha.pity;
      return {
        ...profile,
        gacha: {
          ...profile.gacha,
          pity: { ...pity, ...(standard !== undefined && { character: standard }) },
          losses: {},
          history: profile.gacha.history.map((r) => ({ ...r, lossesBefore: 0, lossesAfter: 0 })),
        },
      };
    },
    // v7 added levels and ascensions (M5.5); every character in a v6 profile is level 1.
    6: (data) => data,
  },
  parse: (data) => {
    const profile = profileSchema.parse(data) as Profile;
    if (profile.team !== undefined && profile.team >= (profile.teams?.length ?? TEAM_PRESETS)) throw new Error('the chosen team is not one of the presets');
    for (const [character, ascensions] of Object.entries(profile.ascensions ?? {})) {
      if ((profile.levels?.[character] ?? 1) < levelCap(ascensions - 1)) throw new Error(`${character} ascended below level ${levelCap(ascensions - 1)}`);
    }
    for (const [character, level] of Object.entries(profile.levels ?? {})) {
      if (level > levelCap(profile.ascensions?.[character] ?? 0)) throw new Error(`${character} is past level ${levelCap(profile.ascensions?.[character] ?? 0)} without ascending`);
    }
    return profile;
  },
};
