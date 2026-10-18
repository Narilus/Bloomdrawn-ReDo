import { describe, expect, it } from 'vitest';
import { memoryAdapter } from './adapters.ts';
import { createSaveStore, SaveError, type SaveKind } from './store.ts';
import v0 from './fixtures/test-v0.json?raw';

// A test save kind at schema v1. v0 stored `hp`; v1 renamed it to `partyHp` and added `turn`.
interface TestSave {
  partyHp: number;
  deck: string[];
  turn: number;
}
const testKind: SaveKind<TestSave> = {
  key: 'test',
  schemaVersion: 1,
  migrations: {
    0: (data) => {
      const { hp, ...rest } = data as { hp: number; deck: string[] };
      return { ...rest, partyHp: hp, turn: 0 };
    },
  },
  parse(data) {
    const d = data as Partial<TestSave>;
    if (typeof d?.partyHp !== 'number' || !Array.isArray(d.deck) || typeof d.turn !== 'number') {
      throw new Error('bad test save');
    }
    return d as TestSave;
  },
};

const save = (partyHp: number): TestSave => ({ partyHp, deck: ['maelia.strike'], turn: 3 });

function setup(contentVersion = 1) {
  const adapter = memoryAdapter();
  return { adapter, store: createSaveStore(adapter, contentVersion) };
}

describe('save store', () => {
  it('round-trips a save', async () => {
    const { store } = setup();
    expect(await store.read(testKind)).toBeNull();
    await store.write(testKind, save(70));
    expect(await store.read(testKind)).toEqual({
      data: save(70),
      source: 'current',
      savedSchemaVersion: 1,
      contentChanged: false,
    });
  });

  it('a failed write leaves the last good save readable', async () => {
    const { adapter, store } = setup();
    await store.write(testKind, save(70));
    adapter.failWrites = true;
    await expect(store.write(testKind, save(10))).rejects.toThrow('Simulated write failure');
    adapter.failWrites = false;
    expect((await store.read(testKind))?.data).toEqual(save(70));
  });

  it('a corrupt current save falls back to the previous good one', async () => {
    const { adapter, store } = setup();
    await store.write(testKind, save(70));
    await store.write(testKind, save(60));
    adapter.data.set('test:current', '{"format":"bloomdrawn-save","kind":"te');
    expect(await store.read(testKind)).toMatchObject({ data: save(70), source: 'previous' });

    // Writing again must not overwrite the previous good save with the corrupt one.
    await store.write(testKind, save(50));
    expect(adapter.data.get('test:previous')).toContain('"partyHp":70');
  });

  it('refuses to write data that would not read back', async () => {
    const { adapter, store } = setup();
    await expect(store.write(testKind, { partyHp: 'x' } as unknown as TestSave)).rejects.toThrow(SaveError);
    expect(adapter.data.size).toBe(0);
  });

  it('migrates a v0 save to v1', async () => {
    const { adapter, store } = setup();
    adapter.data.set('test:current', v0);
    expect(await store.read(testKind)).toEqual({
      data: { partyHp: 42, deck: ['maelia.strike', 'maelia.defense'], turn: 0 },
      source: 'current',
      savedSchemaVersion: 0,
      contentChanged: false,
    });
  });

  it('flags a save made with different content, and rejects saves from a newer game', async () => {
    const { adapter } = setup();
    adapter.data.set('test:current', v0);
    expect((await createSaveStore(adapter, 2).read(testKind))?.contentChanged).toBe(true);
    adapter.data.set('test:current', v0.replace('"schemaVersion": 0', '"schemaVersion": 9'));
    expect(await createSaveStore(adapter, 1).read(testKind)).toBeNull();
  });

  it('exports and imports a save file', async () => {
    const a = setup();
    await a.store.write(testKind, save(33));
    const file = await a.store.exportText(testKind);
    expect(file).toContain('\n  "kind": "test"');

    const b = setup();
    await b.store.write(testKind, save(99));
    await b.store.importText(testKind, file as string);
    expect((await b.store.read(testKind))?.data).toEqual(save(33));
    expect(b.adapter.data.get('test:previous')).toContain('"partyHp":99');
    await expect(b.store.importText(testKind, '{"format":"something-else"}')).rejects.toThrow(SaveError);
    await expect(b.store.importText(testKind, v0)).resolves.toMatchObject({ source: 'import', savedSchemaVersion: 0 });
  });
});
