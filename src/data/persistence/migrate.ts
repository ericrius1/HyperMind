import {
  GRAPH_LOCALSTORAGE_PREFIX,
  SETTINGS_LOCALSTORAGE_KEY,
  parseGraphData,
  type PersistenceStore,
  type StoredSettings,
} from './types';

const MIGRATION_FLAG = 'hypermind.migrated.localstorage.v1';

/** One-shot import of legacy localStorage graph/settings into the durable store. */
export async function migrateLocalStorage(store: PersistenceStore): Promise<number> {
  if (typeof localStorage === 'undefined') return 0;
  if (localStorage.getItem(MIGRATION_FLAG) === '1') return 0;

  let migrated = 0;
  const sceneIds: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(GRAPH_LOCALSTORAGE_PREFIX)) continue;
    sceneIds.push(key.slice(GRAPH_LOCALSTORAGE_PREFIX.length));
  }

  for (const sceneId of sceneIds) {
    try {
      const raw = localStorage.getItem(`${GRAPH_LOCALSTORAGE_PREFIX}${sceneId}`);
      if (!raw) continue;
      const graph = parseGraphData(JSON.parse(raw));
      if (!graph) continue;
      const existing = await store.loadScene(sceneId);
      if (!existing) {
        await store.saveScene(sceneId, graph);
        migrated += 1;
      }
    } catch {
      // Skip corrupt legacy entries.
    }
  }

  try {
    const rawSettings = localStorage.getItem(SETTINGS_LOCALSTORAGE_KEY);
    if (rawSettings && !(await store.loadSettings())) {
      const settings = JSON.parse(rawSettings) as StoredSettings;
      if (settings?.signature && settings.values) {
        await store.saveSettings(settings);
        migrated += 1;
      }
    }
  } catch {
    // Skip corrupt settings.
  }

  localStorage.setItem(MIGRATION_FLAG, '1');
  return migrated;
}
