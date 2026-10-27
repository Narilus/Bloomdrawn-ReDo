import { describe, expect, it } from 'vitest';
import type { BannerDef } from '../engine/index.ts';
import { pull } from '../game/gacha.ts';
import { bank, NEW_PROFILE } from '../game/profile.ts';
import { memoryAdapter } from './adapters.ts';
import { profileSave } from './profile.ts';
import { createSaveStore } from './store.ts';

const BANNER: BannerDef = { id: 'banner.test', name: 'Test', pity: 'test', pool: ['virelle', 'kibane'], sr: { one: ['material.flesh'], amount: 1 }, r: { money: 100 } };

describe('the profile save', () => {
  it('survives a reload: a new store on the same storage reads back what was banked', async () => {
    const adapter = memoryAdapter();
    const before = createSaveStore(adapter, 1);
    await before.write(profileSave, bank(bank(NEW_PROFILE, { pulls: 5, lines: [] }), { pulls: 2, lines: [] }));
    const after = createSaveStore(adapter, 1);
    // A new profile starts with 10 (owner, 25 Oct).
    expect(await after.read(profileSave)).toMatchObject({ data: { pulls: 10 + 7, runs: 2 }, source: 'current' });
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

  it('a v4 profile (M5.2) reads unchanged, with no dupes, items or pulls made', async () => {
    const adapter = memoryAdapter();
    const data = { pulls: 31, runs: 6, owned: [], team: 0, teams: [{ name: 'Mine', members: ['leonora', 'anthe', 'maelia', 'agathe'] }] };
    adapter.data.set('profile:current', JSON.stringify({ format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 4, contentVersion: 1, data }));
    expect(await createSaveStore(adapter, 1).read(profileSave)).toMatchObject({ data, savedSchemaVersion: 4 });
  });

  it('keeps the gacha: its Focus, stream, pity, losses, history, dupes and items read back as pulled', async () => {
    const result = pull({ ...NEW_PROFILE, pulls: 40, owned: ['virelle'], dupes: { virelle: 2 }, focus: 'kibane' }, BANNER, 10, 3);
    if (!result.ok) throw new Error(result.reason);
    const adapter = memoryAdapter();
    await createSaveStore(adapter, 1).write(profileSave, result.profile);
    expect((await createSaveStore(adapter, 1).read(profileSave))?.data).toEqual(result.profile);
  });

  it('never writes a malformed pull history or negative items', async () => {
    const saves = createSaveStore(memoryAdapter(), 1);
    const result = pull({ ...NEW_PROFILE, focus: 'virelle' }, BANNER, 1, 3);
    if (!result.ok) throw new Error(result.reason);
    const { gacha } = result.profile;
    await expect(saves.write(profileSave, { ...result.profile, items: { pollen: -1 } })).rejects.toThrow();
    await expect(saves.write(profileSave, { ...result.profile, dupes: { virelle: 0 } })).rejects.toThrow();
    await expect(saves.write(profileSave, { ...result.profile, gacha: { ...gacha!, history: [{ ...gacha!.history[0]!, rarity: 'ur' as 'r' }] } })).rejects.toThrow();
    await expect(saves.write(profileSave, { ...result.profile, gacha: { ...gacha!, history: [{ ...gacha!.history[0]!, pityAfter: -1 }] } })).rejects.toThrow();
    await expect(saves.write(profileSave, { ...result.profile, gacha: { ...gacha!, losses: { character: -1 } } })).rejects.toThrow();
    await expect(saves.write(profileSave, { ...result.profile, gacha: { ...gacha!, history: [{ ...gacha!.history[0]!, fiftyFifty: 'maybe' as 'won' }] } })).rejects.toThrow();
  });

  it('a v5 profile (Standard banner, 27 Oct) carries its pity to the character banner, with no 50/50 lost and its pulls kept', async () => {
    const adapter = memoryAdapter();
    const record = { n: 1, banner: 'banner.standard', rarity: 'r', items: { pollen: 1, money: 100 }, pityBefore: 6, pityAfter: 7, bloomsBefore: 3, bloomsAfter: 2 };
    const data = { pulls: 2, runs: 1, owned: [], items: { pollen: 1, money: 100 }, gacha: { stream: 99, pity: { standard: 7 }, history: [record] } };
    adapter.data.set('profile:current', JSON.stringify({ format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 5, contentVersion: 1, data }));
    expect((await createSaveStore(adapter, 1).read(profileSave))?.data).toEqual({
      ...data,
      gacha: { stream: 99, pity: { character: 7 }, losses: {}, history: [{ ...record, lossesBefore: 0, lossesAfter: 0 }] },
    });
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
