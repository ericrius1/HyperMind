import type { GraphData } from '../../core/types';
import { MemoryPersistenceStore } from './memoryStore';
import type { HyperMindBundle, PersistenceStore, StoredSettings } from './types';
import SqliteWorker from './sqliteWorker?worker';

type WorkerRequest =
  | { id: number; type: 'open' }
  | { id: number; type: 'loadScene'; sceneId: string }
  | { id: number; type: 'saveScene'; sceneId: string; graph: GraphData }
  | { id: number; type: 'listScenes' }
  | { id: number; type: 'loadSettings' }
  | { id: number; type: 'saveSettings'; settings: StoredSettings }
  | { id: number; type: 'exportBundle'; sceneIds?: string[] }
  | { id: number; type: 'importBundle'; bundle: HyperMindBundle; mode: 'replace' | 'merge' };

type WorkerRequestBody =
  | { type: 'open' }
  | { type: 'loadScene'; sceneId: string }
  | { type: 'saveScene'; sceneId: string; graph: GraphData }
  | { type: 'listScenes' }
  | { type: 'loadSettings' }
  | { type: 'saveSettings'; settings: StoredSettings }
  | { type: 'exportBundle'; sceneIds?: string[] }
  | { type: 'importBundle'; bundle: HyperMindBundle; mode: 'replace' | 'merge' };

type WorkerResponse =
  | { id: number; ok: true; result?: unknown }
  | { id: number; ok: false; error: string };

class SqlitePersistenceStore implements PersistenceStore {
  backend = 'sqlite-pending';
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  async open(): Promise<void> {
    this.worker = new SqliteWorker();
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const waiter = this.pending.get(response.id);
      if (!waiter) return;
      this.pending.delete(response.id);
      if (response.ok) waiter.resolve(response.result);
      else waiter.reject(new Error(response.error));
    };
    this.worker.onerror = (event) => {
      console.error('SQLite persistence worker failed', event);
    };
    const result = await this.call<{ backend: string }>({ type: 'open' });
    this.backend = result.backend;
  }

  loadScene(id: string): Promise<GraphData | null> {
    return this.call({ type: 'loadScene', sceneId: id });
  }

  saveScene(id: string, graph: GraphData): Promise<void> {
    return this.call({ type: 'saveScene', sceneId: id, graph }).then(() => undefined);
  }

  listScenes(): Promise<string[]> {
    return this.call({ type: 'listScenes' });
  }

  loadSettings(): Promise<StoredSettings | null> {
    return this.call({ type: 'loadSettings' });
  }

  saveSettings(settings: StoredSettings): Promise<void> {
    return this.call({ type: 'saveSettings', settings }).then(() => undefined);
  }

  exportBundle(sceneIds?: string[]): Promise<HyperMindBundle> {
    return this.call({ type: 'exportBundle', sceneIds });
  }

  importBundle(bundle: HyperMindBundle, mode: 'replace' | 'merge'): Promise<string[]> {
    return this.call({ type: 'importBundle', bundle, mode });
  }

  private call<T>(payload: WorkerRequestBody): Promise<T> {
    if (!this.worker) return Promise.reject(new Error('Persistence worker is not open'));
    const id = this.nextId++;
    const message = { ...payload, id } as WorkerRequest;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.worker!.postMessage(message);
    });
  }
}

let shared: PersistenceStore | null = null;

export async function openPersistenceStore(): Promise<PersistenceStore> {
  if (shared) return shared;

  try {
    const store = new SqlitePersistenceStore();
    await store.open();
    if (store.backend.startsWith('sqlite')) {
      shared = store;
      void navigator.storage?.persist?.();
      return store;
    }
  } catch (error) {
    console.warn('SQLite OPFS persistence unavailable; falling back to IndexedDB.', error);
  }

  const fallback = new MemoryPersistenceStore({ persistToIndexedDB: true });
  await fallback.open();
  shared = fallback;
  void navigator.storage?.persist?.();
  return fallback;
}

export function getPersistenceStore(): PersistenceStore | null {
  return shared;
}
