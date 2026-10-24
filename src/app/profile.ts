import { CONTENT_VERSION } from '../content/version.ts';
import { bank, NEW_PROFILE, type Banked, type Profile } from '../game/profile.ts';
import { idbAdapter, requestPersistentStorage } from '../save/adapters.ts';
import { profileSave } from '../save/profile.ts';
import { createSaveStore } from '../save/store.ts';

// The profile in the browser's storage. Banking reads the stored profile, adds to it and writes it
// back, one bank at a time, so two ends of runs can never overwrite each other.

const store = createSaveStore(idbAdapter(), CONTENT_VERSION);
let queue: Promise<unknown> = Promise.resolve();

export async function loadProfile(): Promise<Profile> {
  return (await store.read(profileSave))?.data ?? NEW_PROFILE;
}

/** Banks a run's pulls into the stored profile and returns the profile as written. */
export function bankRun(banked: Banked): Promise<Profile> {
  const next = queue.then(async () => {
    const profile = bank(await loadProfile(), banked);
    await store.write(profileSave, profile);
    void requestPersistentStorage();
    return profile;
  });
  queue = next.catch(() => undefined);
  return next;
}
