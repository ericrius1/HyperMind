import type { GraphData } from '../../core/types';
import {
  HYPERMIND_FORMAT,
  HYPERMIND_FORMAT_VERSION,
  type HyperMindBundle,
  type PersistenceStore,
  type StoredSettings,
} from './types';

/** In-memory / IndexedDB-backed store used as a durable fallback when OPFS is unavailable. */
export class MemoryPersistenceStore implements PersistenceStore {
  readonly backend: string;
  private scenes = new Map<string, GraphData>();
  private settings: StoredSettings | null = null;
  private readonly idbName: string | null;

  constructor(options: { backend?: string; persistToIndexedDB?: boolean } = {}) {
    this.backend = options.backend ?? (options.persistToIndexedDB ? 'indexeddb' : 'memory');
    this.idbName = options.persistToIndexedDB ? 'hypermind-persistence' : null;
  }

  async open(): Promise<void> {
    if (!this.idbName) return;
    const stored = await idbGetAll(this.idbName);
    for (const [key, value] of Object.entries(stored.scenes)) {
      this.scenes.set(key, value);
    }
    this.settings = stored.settings;
  }

  async loadScene(id: string): Promise<GraphData | null> {
    const graph = this.scenes.get(id);
    return graph ? structuredClone(graph) : null;
  }

  async saveScene(id: string, graph: GraphData): Promise<void> {
    this.scenes.set(id, structuredClone(graph));
    await this.flush();
  }

  async listScenes(): Promise<string[]> {
    return [...this.scenes.keys()].sort();
  }

  async loadSettings(): Promise<StoredSettings | null> {
    return this.settings ? structuredClone(this.settings) : null;
  }

  async saveSettings(settings: StoredSettings): Promise<void> {
    this.settings = structuredClone(settings);
    await this.flush();
  }

  async exportBundle(sceneIds?: string[]): Promise<HyperMindBundle> {
    const ids = sceneIds ?? await this.listScenes();
    const scenes: Record<string, GraphData> = {};
    for (const id of ids) {
      const graph = await this.loadScene(id);
      if (graph) scenes[id] = graph;
    }
    return {
      format: HYPERMIND_FORMAT,
      version: HYPERMIND_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      scenes,
      settings: this.settings ? structuredClone(this.settings) : undefined,
    };
  }

  async importBundle(bundle: HyperMindBundle, mode: 'replace' | 'merge'): Promise<string[]> {
    const imported = Object.keys(bundle.scenes);
    if (mode === 'replace') {
      for (const id of imported) this.scenes.delete(id);
    }
    for (const [id, graph] of Object.entries(bundle.scenes)) {
      this.scenes.set(id, structuredClone(graph));
    }
    if (bundle.settings) this.settings = structuredClone(bundle.settings);
    await this.flush();
    return imported;
  }

  private async flush(): Promise<void> {
    if (!this.idbName) return;
    const scenes: Record<string, GraphData> = {};
    for (const [id, graph] of this.scenes) scenes[id] = graph;
    await idbPutAll(this.idbName, { scenes, settings: this.settings });
  }
}

interface IdbPayload {
  scenes: Record<string, GraphData>;
  settings: StoredSettings | null;
}

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

async function idbGetAll(name: string): Promise<IdbPayload> {
  const db = await openDb(name);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const request = tx.objectStore('kv').get('state');
    request.onsuccess = () => {
      const value = request.result as IdbPayload | undefined;
      resolve(value ?? { scenes: {}, settings: null });
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
    tx.oncomplete = () => db.close();
  });
}

async function idbPutAll(name: string, payload: IdbPayload): Promise<void> {
  const db = await openDb(name);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(payload, 'state');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
  });
}
