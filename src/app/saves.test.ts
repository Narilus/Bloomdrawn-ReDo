import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import { CONTENT_VERSION } from '../content/version.ts';
import { startCombat } from '../engine/index.ts';
import { M3_EXPEDITION, startExpedition } from '../game/expedition.ts';
import { lossBanking } from '../game/profile.ts';
import { memoryAdapter } from '../save/adapters.ts';
import { profileSave } from '../save/profile.ts';
import type { RunSave } from '../save/run.ts';
import { createSaveStore, encodeSave } from '../save/store.ts';
import { createSaves, RUN_SAVE } from './saves.ts';

// Save and resume (docs/notes/m4-run.md): the profile and the run in storage. Here because the
// run save checks its content against the real registry.

const PARTY = ['agathe', 'maelia', 'anthe', 'leonora'];
const run = (id = 'run-1', seed = 4): RunSave => ({ id, seed, exp: startExpedition(seed, PARTY, M3_EXPEDITION, registry.motifs) });
function setup() {
  const adapter = memoryAdapter();
  return { adapter, saves: createSaves(adapter), store: createSaveStore(adapter, CONTENT_VERSION) };
}
const profileOf = async (store: ReturnType<typeof setup>['store']) => (await store.read(profileSave))?.data;

describe('saves', () => {
  it('a fresh browser has a new profile and no run to continue', async () => {
    expect(await setup().saves.boot(M3_EXPEDITION)).toEqual({ profile: { pulls: 0, runs: 0, owned: [] }, run: null });
  });

  it('a started run is continued exactly as last saved, fight included', async () => {
    const { saves } = setup();
    const save = run();
    await saves.start(save);
    const fighting = { ...save, exp: { ...save.exp, phase: 'fight' as const, fightSeed: 9 } };
    const combat = startCombat({ seed: 9, party: PARTY, enemies: ['enemy.bloom-rib-hound'] }, registry).state;
    void saves.save({ ...fighting, combat: { ...combat, turn: 2 } });
    await saves.save({ ...fighting, combat: { ...combat, turn: 3 } });
    const boot = await saves.boot(M3_EXPEDITION);
    expect(boot.run).toEqual({ ...fighting, combat: { ...combat, turn: 3 } });
    expect(boot.profile.run).toEqual({ id: 'run-1', elites: 0 });
  });

  it("the profile keeps the run's elite tally as it changes", async () => {
    const { saves, store } = setup();
    const save = run();
    await saves.start(save);
    await saves.save({ ...save, exp: { ...save.exp, elites: 2 } });
    expect((await profileOf(store))?.run).toEqual({ id: 'run-1', elites: 2 });
  });

  it('party select keeps its presets and the one chosen, and runs and banking leave them be', async () => {
    const { saves, store } = setup();
    const teams = [{ name: 'Bleeders', members: ['leonora', 'anthe', 'maelia', 'agathe'] }, { name: 'Team 2', members: ['anthe', null, null, null] }];
    await saves.teams(teams, 1);
    expect(await saves.profile()).toEqual({ pulls: 0, runs: 0, owned: [], teams, team: 1 });
    await saves.start(run());
    await saves.end({ pulls: 2, lines: [] });
    expect(await profileOf(store)).toEqual({ pulls: 2, runs: 1, owned: [], teams, team: 1 });
  });

  it('a run that ends banks into the profile and leaves nothing to continue', async () => {
    const { saves, store } = setup();
    await saves.start(run());
    expect(await saves.end({ pulls: 5, lines: [] })).toEqual({ pulls: 5, runs: 1, owned: [] });
    expect(await store.read(RUN_SAVE)).toBeNull();
    expect(await saves.boot(M3_EXPEDITION)).toEqual({ profile: { pulls: 5, runs: 1, owned: [] }, run: null });
  });

  it("an unreadable run ends as abandoned and banks its share from the profile's tally, once", async () => {
    const { saves, adapter } = setup();
    const save = run();
    await saves.start(save);
    await saves.save({ ...save, exp: { ...save.exp, elites: 2 } });
    adapter.data.set('run:current', '{"format":"bloomdrawn-save","kind":"ru');
    adapter.data.set('run:previous', 'not json');
    const boot = await saves.boot(M3_EXPEDITION);
    expect(boot).toEqual({
      profile: { pulls: 2, runs: 1, owned: [] },
      run: null,
      ended: { reason: 'The save is not valid JSON.', banked: lossBanking(2, M3_EXPEDITION) },
    });
    expect(adapter.data.has('run:current')).toBe(false);
    expect(await saves.boot(M3_EXPEDITION)).toEqual({ profile: { pulls: 2, runs: 1, owned: [] }, run: null });
  });

  it('a run naming content the game no longer has, or saved with other content, ends as abandoned', async () => {
    const missing = setup();
    const save = run();
    await missing.saves.start(save);
    const text = encodeSave(RUN_SAVE, save, CONTENT_VERSION).replace('"party":["agathe"', '"party":["no-such-character"');
    missing.adapter.data.set('run:current', text);
    missing.adapter.data.delete('run:previous');
    expect((await missing.saves.boot(M3_EXPEDITION)).ended?.reason).toBe('the game no longer has characters no-such-character');

    const changed = setup();
    await changed.saves.start(save);
    await createSaveStore(changed.adapter, CONTENT_VERSION + 1).write(RUN_SAVE, save);
    expect((await changed.saves.boot(M3_EXPEDITION)).ended?.reason).toBe('it was saved by a different version of the game');
  });

  it('a run save the profile no longer tracks was already banked, and is dropped without banking again', async () => {
    const { saves, store } = setup();
    await store.write(RUN_SAVE, run());
    expect(await saves.boot(M3_EXPEDITION)).toEqual({ profile: { pulls: 0, runs: 0, owned: [] }, run: null });
    expect(await store.read(RUN_SAVE)).toBeNull();
  });

  it('a failed write keeps the last good run', async () => {
    const { saves, adapter } = setup();
    const save = run();
    await saves.start(save);
    adapter.failWrites = true;
    await expect(saves.save({ ...save, exp: { ...save.exp, obols: 99 } })).rejects.toThrow();
    adapter.failWrites = false;
    expect((await saves.boot(M3_EXPEDITION)).run).toEqual(save);
    // Saving goes on once storage works again.
    const later = { ...save, exp: { ...save.exp, obols: 12 } };
    await saves.save(later);
    expect((await saves.boot(M3_EXPEDITION)).run).toEqual(later);
  });

  it('an export imported into an empty browser gives back the same profile and run', async () => {
    const from = setup();
    await from.saves.start(run());
    await from.saves.end({ pulls: 3, lines: [] });
    const save = run('run-2', 8);
    await from.saves.start(save);
    const file = await from.saves.exportFile();

    const to = setup();
    await to.saves.importFile(file);
    expect(await to.saves.boot(M3_EXPEDITION)).toEqual({ profile: { pulls: 3, runs: 1, owned: [], run: { id: 'run-2', elites: 0 } }, run: save });
  });

  it('a file that fails validation changes nothing', async () => {
    const { saves } = setup();
    await saves.start(run());
    const before = await saves.boot(M3_EXPEDITION);
    const file = JSON.parse(await saves.exportFile()) as { saves: { profile: { data: { pulls: number } } } };
    file.saves.profile.data.pulls = -4;
    await expect(saves.importFile(JSON.stringify(file))).rejects.toThrow('failed validation');
    await expect(saves.importFile('{"format":"bloomdrawn-save"}')).rejects.toThrow('not a Bloomdrawn save file');
    expect(await saves.boot(M3_EXPEDITION)).toEqual(before);
  });
});
