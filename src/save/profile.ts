import { z } from 'zod';
import type { Profile } from '../game/profile.ts';
import type { SaveKind } from './store.ts';

const profileSchema = z.strictObject({ pulls: z.int().nonnegative(), runs: z.int().nonnegative() });

/** The profile save (docs/notes/m4-run.md): banked pulls and a run count, for now. */
export const profileSave: SaveKind<Profile> = {
  key: 'profile',
  schemaVersion: 1,
  migrations: {},
  parse: (data) => profileSchema.parse(data),
};
