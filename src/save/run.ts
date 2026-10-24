import { z } from 'zod';
import type { CombatState } from '../engine/index.ts';
import type { Expedition } from '../game/expedition.ts';
import type { SaveKind } from './store.ts';

/** The run in progress: the expedition and, during a fight, the whole combat. */
export interface RunSave {
  /** Matches the profile's run in progress; a save whose ID doesn't was already banked. */
  id: string;
  /** The seed the run started from. */
  seed: number;
  exp: Expedition;
  combat?: CombatState;
}

// The run's state is the game's own plain JSON, so the save checks its outline here and leaves
// the content IDs to `check`, which knows the registry.
const ids = z.array(z.string());
const runSchema = z.strictObject({
  id: z.string().min(1),
  seed: z.int(),
  exp: z.looseObject({
    party: ids,
    phase: z.enum(['map', 'tile', 'fight', 'reward', 'outcome', 'won', 'lost']),
    board: z.looseObject({ tiles: z.record(z.string(), z.looseObject({ kind: z.string() })), at: z.string(), seen: ids }),
    clock: z.int().nonnegative(),
    obols: z.int().nonnegative(),
    elites: z.int().nonnegative(),
    relics: ids,
    offered: ids,
    offeredCards: z.array(z.looseObject({ card: z.string() })),
    deck: z.array(z.looseObject({ card: z.string() })),
    shops: z.record(z.string(), z.looseObject({ relics: z.array(z.looseObject({ relic: z.string() })) })),
    rng: z.record(z.string(), z.unknown()),
  }),
  combat: z
    .looseObject({
      phase: z.enum(['player', 'enemy', 'ended']),
      party: z.looseObject({ statuses: z.array(z.looseObject({ status: z.string() })) }),
      members: z.array(z.looseObject({ character: z.string() })),
      enemies: z.array(z.looseObject({ enemy: z.string(), statuses: z.array(z.looseObject({ status: z.string() })) })),
      relics: z.array(z.looseObject({ relic: z.string() })),
      piles: z.looseObject(Object.fromEntries(['draw', 'hand', 'discard', 'graveyard'].map((p) => [p, z.array(z.looseObject({ card: z.string() }))]))),
      rng: z.record(z.string(), z.unknown()),
    })
    .optional(),
});

/** The run save. `check` throws if the run names content the game no longer has. */
export function runSave(check: (save: RunSave) => void): SaveKind<RunSave> {
  return {
    key: 'run',
    schemaVersion: 1,
    migrations: {},
    parse(data) {
      const save = runSchema.parse(data) as unknown as RunSave;
      check(save);
      return save;
    },
  };
}
