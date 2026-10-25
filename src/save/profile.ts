import { z } from 'zod';
import type { Profile } from '../game/profile.ts';
import type { SaveKind } from './store.ts';

const id = z.string().min(1);

const profileSchema = z.strictObject({
  pulls: z.int().nonnegative(),
  runs: z.int().nonnegative(),
  owned: z.array(id),
  party: z.array(id).optional(),
  run: z.strictObject({ id, elites: z.int().nonnegative() }).optional(),
});

/** The profile save (docs/notes/m4-run.md, m5-collection.md): banked pulls, a run count, the characters gained, the last party and the run in progress's tally. */
export const profileSave: SaveKind<Profile> = {
  key: 'profile',
  schemaVersion: 3,
  migrations: {
    // v2 added the run in progress, which a v1 profile never has.
    1: (data) => data,
    // v3 added the characters gained (none before M5; the starters are always owned) and the last party.
    2: (data) => ({ ...(data as object), owned: [] }),
  },
  parse: (data) => profileSchema.parse(data) as Profile,
};
