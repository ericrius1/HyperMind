import type { GraphData } from '../../core/types';
import type { AppSettings } from '../../config/settings';

export const HYPERMIND_FORMAT = 'hypermind' as const;
export const HYPERMIND_FORMAT_VERSION = 1 as const;
export const GRAPH_LOCALSTORAGE_PREFIX = 'hypermind.graph.v2.';
export const SETTINGS_LOCALSTORAGE_KEY = 'hypermind.settings';

export interface StoredSettings {
  signature: string;
  values: AppSettings;
}

export interface HyperMindBundle {
  format: typeof HYPERMIND_FORMAT;
  version: typeof HYPERMIND_FORMAT_VERSION;
  exportedAt: string;
  scenes: Record<string, GraphData>;
  settings?: StoredSettings;
}

export interface PersistenceStore {
  readonly backend: string;
  open(): Promise<void>;
  loadScene(id: string): Promise<GraphData | null>;
  saveScene(id: string, graph: GraphData): Promise<void>;
  listScenes(): Promise<string[]>;
  loadSettings(): Promise<StoredSettings | null>;
  saveSettings(settings: StoredSettings): Promise<void>;
  exportBundle(sceneIds?: string[]): Promise<HyperMindBundle>;
  importBundle(bundle: HyperMindBundle, mode: 'replace' | 'merge'): Promise<string[]>;
}

export function isHyperMindBundle(value: unknown): value is HyperMindBundle {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as HyperMindBundle;
  return (
    candidate.format === HYPERMIND_FORMAT
    && candidate.version === HYPERMIND_FORMAT_VERSION
    && typeof candidate.exportedAt === 'string'
    && candidate.scenes !== null
    && typeof candidate.scenes === 'object'
  );
}

export function parseGraphData(value: unknown): GraphData | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as GraphData;
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) return null;
  return { nodes: candidate.nodes, edges: candidate.edges };
}
