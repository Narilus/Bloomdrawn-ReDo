import { describe, expect, it } from 'vitest';
import { bank, NEW_PROFILE } from '../game/profile.ts';
import { memoryAdapter } from './adapters.ts';
import { profileSave } from './profile.ts';
import { createSaveStore } from './store.ts';

describe('the profile save', () => {
  it('survives a reload: a new store on the same storage reads back what was banked', async () => {
    const adapter = memoryAdapter();
    const before = createSaveStore(adapter, 1);
    await before.write(profileSave, bank(bank(NEW_PROFILE, { pulls: 5, lines: [] }), { pulls: 2, lines: [] }));
    const after = createSaveStore(adapter, 1);
    expect(await after.read(profileSave)).toMatchObject({ data: { pulls: 7, runs: 2 }, source: 'current' });
  });

  it('never writes or reads a malformed profile', async () => {
    const saves = createSaveStore(memoryAdapter(), 1);
    await expect(saves.write(profileSave, { pulls: -1, runs: 0 })).rejects.toThrow();
    await expect(saves.write(profileSave, { pulls: 1.5, runs: 0 })).rejects.toThrow();
    await expect(saves.importText(profileSave, JSON.stringify({ format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 1, contentVersion: 1, data: { pulls: 3 } }))).rejects.toThrow('failed validation');
    expect(await saves.read(profileSave)).toBeNull();
  });
});
