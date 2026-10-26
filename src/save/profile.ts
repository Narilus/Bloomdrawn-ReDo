import { z } from 'zod';
import { emptyTeam, PARTY_SIZE, TEAM_NAME_LENGTH, TEAM_PRESETS, type Profile } from '../game/profile.ts';
import type { SaveKind } from './store.ts';

const id = z.string().min(1);

const profileSchema = z.strictObject({
  pulls: z.int().nonnegative(),
  runs: z.int().nonnegative(),
  owned: z.array(id),
  teams: z.array(z.strictObject({ name: z.string().min(1).max(TEAM_NAME_LENGTH), members: z.array(id.nullable()).length(PARTY_SIZE) })).min(1).optional(),
  team: z.int().nonnegative().optional(),
  run: z.strictObject({ id, elites: z.int().nonnegative() }).optional(),
});

/** The profile save (docs/notes/m4-run.md, m5-collection.md): banked pulls, a run count, the characters gained, the team presets and the run in progress's tally. */
export const profileSave: SaveKind<Profile> = {
  key: 'profile',
  schemaVersion: 4,
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
  },
  parse: (data) => {
    const profile = profileSchema.parse(data) as Profile;
    if (profile.team !== undefined && profile.team >= (profile.teams?.length ?? TEAM_PRESETS)) throw new Error('the chosen team is not one of the presets');
    return profile;
  },
};
