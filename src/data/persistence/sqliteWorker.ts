/// <reference lib="webworker" />
import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { GraphData } from '../../core/types';
import {
  HYPERMIND_FORMAT,
  HYPERMIND_FORMAT_VERSION,
  type HyperMindBundle,
  type StoredSettings,
} from './types';

type WorkerRequest =
  | { id: number; type: 'open' }
  | { id: number; type: 'loadScene'; sceneId: string }
  | { id: number; type: 'saveScene'; sceneId: string; graph: GraphData }
  | { id: number; type: 'listScenes' }
  | { id: number; type: 'loadSettings' }
  | { id: number; type: 'saveSettings'; settings: StoredSettings }
  | { id: number; type: 'exportBundle'; sceneIds?: string[] }
  | { id: number; type: 'importBundle'; bundle: HyperMindBundle; mode: 'replace' | 'merge' };

type WorkerResponse =
  | { id: number; ok: true; result?: unknown }
  | { id: number; ok: false; error: string };

let db: Database | null = null;
let backend = 'sqlite-memory';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  updated_at INTEGER NOT NULL,
  graph_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

async function openDatabase(sqlite3: Sqlite3Static): Promise<void> {
  if (sqlite3.oo1.OpfsDb) {
    db = new sqlite3.oo1.OpfsDb('/hypermind.sqlite3');
    backend = 'sqlite-opfs';
  } else {
    db = new sqlite3.oo1.DB('/hypermind.sqlite3', 'ct');
    backend = 'sqlite-memory';
  }
  db.exec(SCHEMA);
}

function requireDb(): Database {
  if (!db) throw new Error('SQLite database is not open');
  return db;
}

function loadScene(sceneId: string): GraphData | null {
  const row = requireDb().selectObject('SELECT graph_json AS graphJson FROM scenes WHERE id = ?', [sceneId]) as
    | { graphJson: string }
    | undefined;
  if (!row) return null;
  return JSON.parse(row.graphJson) as GraphData;
}

function saveScene(sceneId: string, graph: GraphData): void {
  requireDb().exec({
    sql: `INSERT INTO scenes(id, updated_at, graph_json) VALUES(?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, graph_json = excluded.graph_json`,
    bind: [sceneId, Date.now(), JSON.stringify(graph)],
  });
}

function listScenes(): string[] {
  const rows = requireDb().selectArrays('SELECT id FROM scenes ORDER BY id') as string[][];
  return rows.map((row) => row[0]!).filter(Boolean);
}

function loadSettings(): StoredSettings | null {
  const row = requireDb().selectObject(`SELECT value FROM meta WHERE key = 'settings'`) as { value: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.value) as StoredSettings;
}

function saveSettings(settings: StoredSettings): void {
  requireDb().exec({
    sql: `INSERT INTO meta(key, value) VALUES('settings', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    bind: [JSON.stringify(settings)],
  });
}

function exportBundle(sceneIds?: string[]): HyperMindBundle {
  const ids = sceneIds ?? listScenes();
  const scenes: Record<string, GraphData> = {};
  for (const id of ids) {
    const graph = loadScene(id);
    if (graph) scenes[id] = graph;
  }
  return {
    format: HYPERMIND_FORMAT,
    version: HYPERMIND_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    scenes,
    settings: loadSettings() ?? undefined,
  };
}

function importBundle(bundle: HyperMindBundle, mode: 'replace' | 'merge'): string[] {
  const imported = Object.keys(bundle.scenes);
  requireDb().exec('BEGIN');
  try {
    if (mode === 'replace') {
      for (const id of imported) {
        requireDb().exec({ sql: 'DELETE FROM scenes WHERE id = ?', bind: [id] });
      }
    }
    for (const [id, graph] of Object.entries(bundle.scenes)) {
      saveScene(id, graph);
    }
    if (bundle.settings) saveSettings(bundle.settings);
    requireDb().exec('COMMIT');
  } catch (error) {
    requireDb().exec('ROLLBACK');
    throw error;
  }
  return imported;
}

async function handle(request: WorkerRequest): Promise<unknown> {
  switch (request.type) {
    case 'open': {
      const sqlite3 = await sqlite3InitModule();
      await openDatabase(sqlite3);
      return { backend };
    }
    case 'loadScene':
      return loadScene(request.sceneId);
    case 'saveScene':
      saveScene(request.sceneId, request.graph);
      return null;
    case 'listScenes':
      return listScenes();
    case 'loadSettings':
      return loadSettings();
    case 'saveSettings':
      saveSettings(request.settings);
      return null;
    case 'exportBundle':
      return exportBundle(request.sceneIds);
    case 'importBundle':
      return importBundle(request.bundle, request.mode);
    default:
      throw new Error(`Unknown persistence worker request`);
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    const result = await handle(request);
    const response: WorkerResponse = { id: request.id, ok: true, result };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
