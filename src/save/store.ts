// Versioned saves. Each save is a JSON envelope stored as text under `<kind>:current`, with
// the last good one kept under `<kind>:previous`. A failed or corrupt write never replaces
// the last good save.

export interface SaveAdapter {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

/** One kind of save (profile, active run). */
export interface SaveKind<T> {
  key: string;
  /** Current schema version. Migrations step older saves up to it one version at a time. */
  schemaVersion: number;
  /** `migrations[n]` turns version n data into version n + 1 data. */
  migrations: Record<number, (data: unknown) => unknown>;
  /** Validates migrated data; throws if it is not a valid save. */
  parse: (data: unknown) => T;
}

export interface Envelope {
  format: 'bloomdrawn-save';
  kind: string;
  schemaVersion: number;
  contentVersion: number;
  data: unknown;
}

export interface Loaded<T> {
  data: T;
  /** Where it was read from: `previous` means the current save was unreadable. */
  source: 'current' | 'previous' | 'import';
  /** Schema version as written, before migration. */
  savedSchemaVersion: number;
  /** True when the save was made with different content; the caller decides whether a run survives. */
  contentChanged: boolean;
}

export class SaveError extends Error {}

export function createSaveStore(adapter: SaveAdapter, contentVersion: number) {
  const keys = (kind: SaveKind<unknown>) => ({ current: `${kind.key}:current`, previous: `${kind.key}:previous` });

  function decode<T>(kind: SaveKind<T>, text: string | undefined, source: Loaded<T>['source']): Loaded<T> {
    if (text === undefined) throw new SaveError('No save.');
    let envelope: Envelope;
    try {
      envelope = JSON.parse(text) as Envelope;
    } catch {
      throw new SaveError('The save is not valid JSON.');
    }
    if (envelope?.format !== 'bloomdrawn-save' || envelope.kind !== kind.key) {
      throw new SaveError(`This is not a ${kind.key} save.`);
    }
    if (!Number.isInteger(envelope.schemaVersion) || envelope.schemaVersion > kind.schemaVersion) {
      throw new SaveError('This save comes from a newer version of the game.');
    }
    let data = envelope.data;
    for (let v = envelope.schemaVersion; v < kind.schemaVersion; v++) {
      const migrate = kind.migrations[v];
      if (!migrate) throw new SaveError(`No migration from save version ${v}.`);
      data = migrate(data);
    }
    try {
      return {
        data: kind.parse(data),
        source,
        savedSchemaVersion: envelope.schemaVersion,
        contentChanged: envelope.contentVersion !== contentVersion,
      };
    } catch (err) {
      throw new SaveError(`The save failed validation: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function encode<T>(kind: SaveKind<T>, data: T): string {
    const envelope: Envelope = { format: 'bloomdrawn-save', kind: kind.key, schemaVersion: kind.schemaVersion, contentVersion, data };
    const text = JSON.stringify(envelope);
    decode(kind, text, 'current'); // never write something that can't be read back
    return text;
  }

  async function readable<T>(kind: SaveKind<T>, key: string): Promise<boolean> {
    try {
      decode(kind, await adapter.get(key), 'current');
      return true;
    } catch {
      return false;
    }
  }

  async function writeText<T>(kind: SaveKind<T>, text: string): Promise<void> {
    const k = keys(kind);
    const current = await adapter.get(k.current);
    if (current !== undefined && (await readable(kind, k.current))) await adapter.set(k.previous, current);
    await adapter.set(k.current, text);
  }

  return {
    /** Writes a save, first keeping the current one (if readable) as the previous good save. */
    async write<T>(kind: SaveKind<T>, data: T): Promise<void> {
      await writeText(kind, encode(kind, data));
    },

    /** Reads the current save, falling back to the previous good one. Null if neither is readable. */
    async read<T>(kind: SaveKind<T>): Promise<Loaded<T> | null> {
      const k = keys(kind);
      for (const [key, source] of [[k.current, 'current'], [k.previous, 'previous']] as const) {
        try {
          return decode(kind, await adapter.get(key), source);
        } catch {
          // fall through to the previous good save
        }
      }
      return null;
    },

    /** The readable save as pretty JSON text for an export file, or null if there is none. */
    async exportText<T>(kind: SaveKind<T>): Promise<string | null> {
      const loaded = await this.read(kind);
      return loaded ? JSON.stringify(JSON.parse(encode(kind, loaded.data)), null, 2) : null;
    },

    /** Validates an imported file, migrates it, and writes it as the current save. Throws SaveError. */
    async importText<T>(kind: SaveKind<T>, text: string): Promise<Loaded<T>> {
      const loaded = decode(kind, text, 'import');
      await writeText(kind, encode(kind, loaded.data));
      return loaded;
    },
  };
}

export type SaveStore = ReturnType<typeof createSaveStore>;
