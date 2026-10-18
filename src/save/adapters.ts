import { createStore, get, set } from 'idb-keyval';
import type { SaveAdapter } from './store.ts';

/** Browser saves: plain JSON text in IndexedDB. */
export function idbAdapter(dbName = 'bloomdrawn'): SaveAdapter {
  const store = createStore(dbName, 'saves');
  return {
    get: (key) => get<string>(key, store),
    set: (key, value) => set(key, value, store),
  };
}

/** Asks the browser not to evict saves under storage pressure. Resolves false if refused or unsupported. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** In-memory saves for tests. `failWrites` makes every write throw before storing anything. */
export function memoryAdapter(): SaveAdapter & { data: Map<string, string>; failWrites: boolean } {
  const data = new Map<string, string>();
  return {
    data,
    failWrites: false,
    async get(key) {
      return data.get(key);
    },
    async set(key, value) {
      if (this.failWrites) throw new Error('Simulated write failure');
      data.set(key, value);
    },
  };
}
