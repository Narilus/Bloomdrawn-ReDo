import { itemCount } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import { CONTENT_VERSION } from '../content/version.ts';
import { missingContent } from '../game/check.ts';
import type { ExpeditionDef } from '../game/expedition.ts';
import type { BannerDef } from '../engine/index.ts';
import { chooseFocus, pull } from '../game/gacha.ts';
import { ascend, levelUp } from '../game/levels.ts';
import { bank, buyPreset, lossBanking, NEW_PROFILE, type Banked, type Profile, type Team } from '../game/profile.ts';
import { idbAdapter, requestPersistentStorage } from '../save/adapters.ts';
import { profileSave } from '../save/profile.ts';
import { runSave, type RunSave } from '../save/run.ts';
import { createSaveStore, type SaveAdapter } from '../save/store.ts';

// The profile and the run in the browser's storage (docs/notes/m4-run.md, "Save and resume").
// Every write goes through one queue, so they land in the order they were made, and a burst of run
// saves (one per combat command) writes only the newest.

export const RUN_SAVE = runSave((save) => {
  const missing = missingContent(save.exp, save.combat, registry);
  if (missing) throw new Error(`the game no longer has ${missing}`);
});

/** What the title screen needs: the profile, the run to continue, and why a run had to end, if one did. */
export interface Boot {
  profile: Profile;
  run: RunSave | null;
  ended?: { reason: string; banked: Banked };
}

export function createSaves(adapter: SaveAdapter) {
  const store = createSaveStore(adapter, CONTENT_VERSION);
  const kinds = [profileSave, RUN_SAVE] as const;
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const next = queue.then(job);
    queue = next.catch(() => undefined); // the caller hears of a failure; the queue goes on
    return next;
  };
  const readProfile = async () => (await store.read(profileSave))?.data ?? NEW_PROFILE;

  let pending: RunSave | null = null;
  let flushing: Promise<void> | null = null;
  async function flush() {
    try {
      while (pending) {
        const save = pending;
        pending = null;
        await store.write(RUN_SAVE, save);
        // The banking tally lives in the profile too, so it survives a run save that can't be read.
        const profile = await readProfile();
        if (profile.run?.id === save.id && profile.run.elites !== save.exp.elites) {
          await store.write(profileSave, { ...profile, run: { id: save.id, elites: save.exp.elites } });
        }
      }
    } finally {
      // A failed write must not stop the next save from starting a flush of its own.
      flushing = null;
    }
  }

  /** Writes the profile a profile action left, if it wasn't refused. */
  const keep = async <R extends { ok: true; profile: Profile } | { ok: false; reason: string }>(result: R): Promise<R> => {
    if (result.ok) await store.write(profileSave, result.profile);
    return result;
  };

  /** Banks a run that ended and forgets its save. */
  const end = (banked: Banked) =>
    enqueue(async () => {
      const profile = bank(await readProfile(), banked);
      await store.write(profileSave, profile);
      await store.remove(RUN_SAVE);
      void requestPersistentStorage();
      return profile;
    });

  return {
    /**
     * Reads the saves at start. A run save that doesn't match the profile's run in progress was
     * already banked and is dropped. A run in progress that can't be resumed ends as abandoned and
     * banks its share from the profile's tally (owner, 24 Oct).
     */
    boot: (def: ExpeditionDef) =>
      enqueue(async (): Promise<Boot> => {
        const profile = await readProfile();
        const result = await store.load(RUN_SAVE);
        if (!profile.run) {
          if (result) await store.remove(RUN_SAVE);
          return { profile, run: null };
        }
        const save = result?.ok ? result.loaded : undefined;
        if (save && save.data.id === profile.run.id && !save.contentChanged) return { profile, run: save.data };
        const reason = !result
          ? 'its save is missing'
          : !result.ok
            ? result.reason.replace(/^The save failed validation: /, '')
            : save!.data.id !== profile.run.id
              ? 'its save belongs to another run'
              : 'it was saved by a different version of the game';
        const banked = lossBanking(profile.run.elites, def, itemCount);
        const after = bank(profile, banked);
        await store.write(profileSave, after);
        await store.remove(RUN_SAVE);
        return { profile: after, run: null, ended: { reason, banked } };
      }),

    /** Starts a run: the profile records it as in progress, then its first save is written. */
    start: (save: RunSave) =>
      enqueue(async () => {
        const profile = await readProfile();
        await store.write(profileSave, { ...profile, run: { id: save.id, elites: save.exp.elites } });
        await store.write(RUN_SAVE, save);
      }),

    /** Saves the run as it stands. Only the newest of a burst is written. */
    save(save: RunSave): Promise<void> {
      pending = save;
      flushing ??= enqueue(flush);
      return flushing;
    },

    end,

    /** Keeps the team presets and the one chosen, as party select changes them. */
    teams: (teams: Team[], team: number) =>
      enqueue(async () => {
        await store.write(profileSave, { ...(await readProfile()), teams, team });
      }),

    /**
     * Pulls on a banner and keeps the profile it leaves; a refused pull writes nothing. The run in
     * progress and its save are never touched (DESIGN.md: gacha randomness never touches a run's).
     */
    pull: (banner: BannerDef, count: 1 | 10, seed: number) =>
      enqueue(async () => {
        const result = pull(await readProfile(), banner, count, seed);
        if (result.ok) await store.write(profileSave, result.profile);
        return result;
      }),

    /** Keeps a new Focus for the banner; pity and the 50/50 losses carry over (owner, 28 Oct). */
    focus: (banner: BannerDef, character: string) =>
      enqueue(async () => {
        const profile = chooseFocus(await readProfile(), banner, character);
        await store.write(profileSave, profile);
        return profile;
      }),

    /** Raises a character `levels` levels, paying in Memories and Ducats; a refusal writes nothing. */
    levelUp: (character: string, levels: number) => enqueue(async () => keep(levelUp(await readProfile(), character, levels))),

    /** Ascends a character at her level cap; a refusal writes nothing. */
    ascend: (character: string) => enqueue(async () => keep(ascend(await readProfile(), character, registry))),

    /** Buys one more team preset with Ducats; a refusal writes nothing. */
    buyPreset: (owned: readonly string[]) => enqueue(async () => keep(buyPreset(await readProfile(), owned))),

    /** The profile as saved, after any writes in flight. */
    profile: () => enqueue(readProfile),

    /** Both saves in one file. */
    exportFile: () => enqueue(() => store.exportBackup([...kinds])),

    /** Replaces both saves with a file's; a file that fails validation changes nothing. Throws SaveError. */
    importFile: (text: string) => enqueue(() => store.importBackup([...kinds], text)),
  };
}

export type Saves = ReturnType<typeof createSaves>;

let browser: Saves | undefined;
/** The browser's saves, opened on first use (so tests can import this file without IndexedDB). */
export const browserSaves = (): Saves => (browser ??= createSaves(idbAdapter()));
