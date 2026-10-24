// Versioned saves. Each save is a JSON envelope stored as text under `<kind>:current`, with
// the last good one kept under `<kind>:previous`. A failed or corrupt write never replaces
// the last good save.

export interface SaveAdapter {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
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

/** A read: the save, or why there is none to use. */
export type LoadResult<T> = { ok: true; loaded: Loaded<T> } | { ok: false; reason: string };

/** Reads one save's text: checks its envelope, migrates it and validates it. Throws SaveError. */
export function decodeSave<T>(kind: SaveKind<T>, text: string | undefined, contentVersion: number, source: Loaded<T>['source'] = 'current'): Loaded<T> {
  if (text === undefined) throw new SaveError('No save.');
  let envelope: Envelope;
  try {
    envelope = JSON.parse(text) as Envelope;
  } catch {
    throw new SaveError('The save is not valid JSON.');
  }
  return decodeEnvelope(kind, envelope, contentVersion, source);
}

function decodeEnvelope<T>(kind: SaveKind<T>, envelope: Envelope, contentVersion: number, source: Loaded<T>['source']): Loaded<T> {
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

/** One save as text, checked to read back. Throws SaveError if it wouldn't. */
export function encodeSave<T>(kind: SaveKind<T>, data: T, contentVersion: number): string {
  const envelope: Envelope = { format: 'bloomdrawn-save', kind: kind.key, schemaVersion: kind.schemaVersion, contentVersion, data };
  const text = JSON.stringify(envelope);
  decodeSave(kind, text, contentVersion); // never write something that can't be read back
  return text;
}

/** A backup file: every kind of save in one, for moving them between browsers. */
interface Backup {
  format: 'bloomdrawn-backup';
  saves: Record<string, Envelope>;
}

export function createSaveStore(adapter: SaveAdapter, contentVersion: number) {
  const keys = (kind: SaveKind<unknown>) => ({ current: `${kind.key}:current`, previous: `${kind.key}:previous` });
  const encode = <T>(kind: SaveKind<T>, data: T) => encodeSave(kind, data, contentVersion);

  async function readable<T>(kind: SaveKind<T>, key: string): Promise<boolean> {
    try {
      decodeSave(kind, await adapter.get(key), contentVersion);
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

  /** The current save, else the previous good one; null if nothing is stored, or why neither can be used. */
  async function load<T>(kind: SaveKind<T>): Promise<LoadResult<T> | null> {
    const k = keys(kind);
    let reason: string | undefined;
    for (const [key, source] of [[k.current, 'current'], [k.previous, 'previous']] as const) {
      const text = await adapter.get(key);
      if (text === undefined) continue;
      try {
        return { ok: true, loaded: decodeSave(kind, text, contentVersion, source) };
      } catch (err) {
        reason ??= err instanceof Error ? err.message : String(err);
      }
    }
    return reason === undefined ? null : { ok: false, reason };
  }

  return {
    /** Writes a save, first keeping the current one (if readable) as the previous good save. */
    async write<T>(kind: SaveKind<T>, data: T): Promise<void> {
      await writeText(kind, encode(kind, data));
    },

    load,

    /** Reads the current save, falling back to the previous good one. Null if neither is readable. */
    async read<T>(kind: SaveKind<T>): Promise<Loaded<T> | null> {
      const result = await load(kind);
      return result?.ok ? result.loaded : null;
    },

    /** Deletes a save and its previous good copy. */
    async remove<T>(kind: SaveKind<T>): Promise<void> {
      const k = keys(kind);
      await adapter.del(k.current);
      await adapter.del(k.previous);
    },

    /** The readable save as pretty JSON text for an export file, or null if there is none. */
    async exportText<T>(kind: SaveKind<T>): Promise<string | null> {
      const loaded = await this.read(kind);
      return loaded ? JSON.stringify(JSON.parse(encode(kind, loaded.data)), null, 2) : null;
    },

    /** Validates an imported file, migrates it, and writes it as the current save. Throws SaveError. */
    async importText<T>(kind: SaveKind<T>, text: string): Promise<Loaded<T>> {
      const loaded = decodeSave(kind, text, contentVersion, 'import');
      await writeText(kind, encode(kind, loaded.data));
      return loaded;
    },

    /** Every readable save of these kinds in one backup file, as pretty JSON text. */
    async exportBackup(kinds: SaveKind<unknown>[]): Promise<string> {
      const backup: Backup = { format: 'bloomdrawn-backup', saves: {} };
      for (const kind of kinds) {
        const loaded = await this.read(kind);
        if (loaded) backup.saves[kind.key] = JSON.parse(encode(kind, loaded.data)) as Envelope;
      }
      return JSON.stringify(backup, null, 2);
    },

    /**
     * Restores a backup file: every save in it must read back before anything is written, so a
     * file that fails changes nothing. A kind the file lacks is removed. Throws SaveError.
     */
    async importBackup(kinds: SaveKind<unknown>[], text: string): Promise<void> {
      let backup: Backup;
      try {
        backup = JSON.parse(text) as Backup;
      } catch {
        throw new SaveError('The file is not valid JSON.');
      }
      if (backup?.format !== 'bloomdrawn-backup' || typeof backup.saves !== 'object' || backup.saves === null) {
        throw new SaveError('This is not a Bloomdrawn save file.');
      }
      const decoded = kinds.map((kind) => {
        const envelope = backup.saves[kind.key];
        return { kind, loaded: envelope === undefined ? undefined : decodeEnvelope(kind, envelope, contentVersion, 'import') };
      });
      for (const { kind, loaded } of decoded) {
        if (loaded) await writeText(kind, encode(kind, loaded.data));
        else await this.remove(kind);
      }
    },
  };
}

export type SaveStore = ReturnType<typeof createSaveStore>;
