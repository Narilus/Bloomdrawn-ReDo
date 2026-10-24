import { z } from 'zod';
import type { Profile } from '../game/profile.ts';
import type { SaveKind } from './store.ts';

const profileSchema = z.strictObject({
  pulls: z.int().nonnegative(),
  runs: z.int().nonnegative(),
  run: z.strictObject({ id: z.string().min(1), elites: z.int().nonnegative() }).optional(),
});

/** The profile save (docs/notes/m4-run.md): banked pulls, a run count and the run in progress's tally, for now. */
export const profileSave: SaveKind<Profile> = {
  key: 'profile',
  schemaVersion: 2,
  // v2 added the run in progress, which a v1 profile never has.
  migrations: { 1: (data) => data },
  parse: (data) => profileSchema.parse(data) as Profile,
};
