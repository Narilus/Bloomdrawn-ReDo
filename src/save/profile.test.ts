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
    await expect(saves.write(profileSave, { pulls: -1, runs: 0, owned: [] })).rejects.toThrow();
    await expect(saves.write(profileSave, { pulls: 1.5, runs: 0, owned: [] })).rejects.toThrow();
    await expect(saves.write(profileSave, { pulls: 1, runs: 0, owned: [''] })).rejects.toThrow();
    await expect(saves.importText(profileSave, JSON.stringify({ format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 1, contentVersion: 1, data: { pulls: 3 } }))).rejects.toThrow('failed validation');
    expect(await saves.read(profileSave)).toBeNull();
  });

  it('a v1 profile (M4.3, before the run in progress was kept) reads with no run in progress and nothing gained', async () => {
    const adapter = memoryAdapter();
    adapter.data.set('profile:current', JSON.stringify({ format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 1, contentVersion: 1, data: { pulls: 12, runs: 3 } }));
    expect(await createSaveStore(adapter, 1).read(profileSave)).toMatchObject({ data: { pulls: 12, runs: 3, owned: [] }, savedSchemaVersion: 1 });
  });

  it('a v2 profile (M4.4) keeps its pulls, runs and run in progress, and has gained no characters', async () => {
    const adapter = memoryAdapter();
    const data = { pulls: 7, runs: 4, run: { id: 'run-9', elites: 2 } };
    adapter.data.set('profile:current', JSON.stringify({ format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 2, contentVersion: 1, data }));
    expect(await createSaveStore(adapter, 1).read(profileSave)).toMatchObject({ data: { ...data, owned: [] }, savedSchemaVersion: 2 });
  });

  it('a v3 profile (M5.1) keeps its last party as Team 1 of five presets, chosen', async () => {
    const adapter = memoryAdapter();
    const data = { pulls: 7, runs: 4, owned: ['virelle'], party: ['leonora', 'anthe', 'maelia', 'agathe'] };
    adapter.data.set('profile:current', JSON.stringify({ format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 3, contentVersion: 1, data }));
    const read = await createSaveStore(adapter, 1).read(profileSave);
    expect(read?.data).toEqual({ pulls: 7, runs: 4, owned: ['virelle'], team: 0, teams: [
      { name: 'Team 1', members: ['leonora', 'anthe', 'maelia', 'agathe'] },
      ...[2, 3, 4, 5].map((n) => ({ name: `Team ${n}`, members: [null, null, null, null] })),
    ] });
    adapter.data.set('profile:current', JSON.stringify({ format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 3, contentVersion: 1, data: { pulls: 1, runs: 0, owned: [] } }));
    expect((await createSaveStore(adapter, 1).read(profileSave))?.data).toEqual({ pulls: 1, runs: 0, owned: [] });
  });

  it('never writes presets with the wrong number of places, a blank name, or a chosen team that is not one of them', async () => {
    const saves = createSaveStore(memoryAdapter(), 1);
    const team = (members: (string | null)[], name = 'Team 1') => ({ name, members });
    await expect(saves.write(profileSave, { ...NEW_PROFILE, teams: [team(['a', 'b', 'c'])] })).rejects.toThrow();
    await expect(saves.write(profileSave, { ...NEW_PROFILE, teams: [team(['a', null, null, null], '')] })).rejects.toThrow();
    await expect(saves.write(profileSave, { ...NEW_PROFILE, teams: [team(['a', null, null, null])], team: 1 })).rejects.toThrow('chosen team');
    await saves.write(profileSave, { ...NEW_PROFILE, teams: [team(['a', null, null, null])], team: 0 });
    expect((await saves.read(profileSave))?.data.teams).toEqual([team(['a', null, null, null])]);
  });
});
