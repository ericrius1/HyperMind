import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS, SETTINGS_SCHEMA_SIGNATURE } from '../../config/settings';
import { MemoryPersistenceStore } from './memoryStore';
import { decodeBundle, encodeBundle } from './fileTransfer';
import { migrateLocalStorage } from './migrate';
import {
  HYPERMIND_FORMAT,
  HYPERMIND_FORMAT_VERSION,
  type HyperMindBundle,
} from './types';

const sampleGraph = {
  nodes: [{
    id: 'n1',
    title: 'Alpha',
    description: 'First',
    cluster: 0,
    position: [0, 0, 0] as [number, number, number],
    radius: 1,
    tags: ['a'],
  }],
  edges: [],
};

describe('MemoryPersistenceStore', () => {
  it('saves and loads scenes and settings', async () => {
    const store = new MemoryPersistenceStore();
    await store.open();
    await store.saveScene('tutorial', sampleGraph);
    await store.saveSettings({ signature: SETTINGS_SCHEMA_SIGNATURE, values: { ...SETTINGS_DEFAULTS, glow: 0.5 } });

    expect(await store.loadScene('tutorial')).toEqual(sampleGraph);
    expect(await store.listScenes()).toEqual(['tutorial']);
    expect((await store.loadSettings())?.values.glow).toBe(0.5);
  });

  it('exports and imports bundles with replace semantics', async () => {
    const store = new MemoryPersistenceStore();
    await store.open();
    await store.saveScene('tutorial', sampleGraph);
    await store.saveScene('keep', sampleGraph);

    const bundle = await store.exportBundle(['tutorial']);
    expect(bundle.format).toBe(HYPERMIND_FORMAT);
    expect(Object.keys(bundle.scenes)).toEqual(['tutorial']);

    const other = {
      ...sampleGraph,
      nodes: [{ ...sampleGraph.nodes[0]!, title: 'Beta' }],
    };
    await store.importBundle({
      format: HYPERMIND_FORMAT,
      version: HYPERMIND_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      scenes: { tutorial: other },
    }, 'replace');

    expect((await store.loadScene('tutorial'))?.nodes[0]?.title).toBe('Beta');
    expect(await store.loadScene('keep')).toEqual(sampleGraph);
  });
});

describe('fileTransfer', () => {
  it('round-trips .hypermind JSON bytes', () => {
    const bundle: HyperMindBundle = {
      format: HYPERMIND_FORMAT,
      version: HYPERMIND_FORMAT_VERSION,
      exportedAt: '2026-07-13T00:00:00.000Z',
      scenes: { tutorial: sampleGraph },
    };
    const decoded = decodeBundle(encodeBundle(bundle));
    expect(decoded).toEqual(bundle);
  });
});

describe('migrateLocalStorage', () => {
  it('imports legacy localStorage once', async () => {
    const memory = new Map<string, string>();
    const fakeStorage = {
      get length() { return memory.size; },
      clear: () => memory.clear(),
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
      key: (index: number) => [...memory.keys()][index] ?? null,
    } satisfies Storage;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: fakeStorage });

    localStorage.clear();
    localStorage.setItem('hypermind.graph.v2.tutorial', JSON.stringify(sampleGraph));
    localStorage.setItem('hypermind.settings', JSON.stringify({
      signature: SETTINGS_SCHEMA_SIGNATURE,
      values: { ...SETTINGS_DEFAULTS, pulse: 0.9 },
    }));

    const store = new MemoryPersistenceStore();
    await store.open();
    expect(await migrateLocalStorage(store)).toBe(2);
    expect(await migrateLocalStorage(store)).toBe(0);
    expect((await store.loadScene('tutorial'))?.nodes[0]?.title).toBe('Alpha');
    expect((await store.loadSettings())?.values.pulse).toBe(0.9);
  });
});
