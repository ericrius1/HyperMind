import type { CameraMode, LayoutId, PaletteId, PhysicsEngineId, RenderSkinId, ViewDimension } from '../core/types';
import type { PersistenceStore, StoredSettings } from '../data/persistence';

export interface AppSettings {
  dimension: ViewDimension;
  cameraMode: CameraMode;
  skin: RenderSkinId;
  palette: PaletteId;
  layout: LayoutId;
  physicsEngine: PhysicsEngineId;
  minZoom: number;
  maxZoom: number;
  animations: boolean;
  dragInfluence: boolean;
  nodeScale: number;
  nodeDensity: number;
  dreamFieldLayers: number;
  dreamFieldScale: number;
  dreamWarp: number;
  dreamJitter: number;
  dreamLodStrength: number;
  edgeOpacity: number;
  glow: number;
  pulse: number;
  repulsion: number;
  spring: number;
  springLength: number;
  centering: number;
  damping: number;
  clusterStrength: number;
  simulationSpeed: number;
  resolutionScale: number;
  raySteps: number;
  showLabels: boolean;
  showLandmarks: boolean;
  showGrid: boolean;
  showHelp: boolean;
}

export type SettingFolder = 'View' | 'Nodes' | 'Links' | 'Physics' | 'Effects' | 'Performance' | 'Debug / overlays';

interface BaseField<K extends keyof AppSettings> {
  key: K;
  label: string;
  folder: SettingFolder;
}

export type FieldDefinition<K extends keyof AppSettings = keyof AppSettings> = BaseField<K> & (
  | { kind: 'number'; min: number; max: number; step: number }
  | { kind: 'boolean' }
  | { kind: 'options'; options: Record<string, AppSettings[K]> }
);

export const SETTINGS_DEFAULTS: AppSettings = {
  dimension: '2d',
  cameraMode: 'orbit',
  skin: 'luminous',
  palette: 'cobalt',
  layout: 'clusters',
  physicsEngine: 'webgpu',
  minZoom: 0.9,
  maxZoom: 90,
  animations: true,
  dragInfluence: true,
  nodeScale: 1,
  nodeDensity: 1,
  dreamFieldLayers: 2,
  dreamFieldScale: 1,
  dreamWarp: 0.17,
  dreamJitter: 0.65,
  dreamLodStrength: 0.8,
  edgeOpacity: 0.34,
  glow: 0.82,
  pulse: 0.28,
  repulsion: 7.5,
  spring: 2.2,
  springLength: 2.8,
  centering: 0.18,
  damping: 0.86,
  clusterStrength: 0.48,
  simulationSpeed: 1,
  resolutionScale: 1,
  raySteps: 24,
  showLabels: true,
  showLandmarks: false,
  showGrid: true,
  showHelp: true,
};

export const SETTING_FIELDS: FieldDefinition[] = [
  { key: 'dimension', label: 'Space', folder: 'View', kind: 'options', options: { '2D canvas': '2d', '3D space': '3d' } },
  { key: 'cameraMode', label: '3D camera', folder: 'View', kind: 'options', options: { Orbit: 'orbit', Fly: 'fly' } },
  { key: 'skin', label: 'Render mode', folder: 'View', kind: 'options', options: { Paperlight: 'simple', Luminous: 'luminous', 'Midnight core': 'dream' } },
  { key: 'palette', label: 'Color world', folder: 'View', kind: 'options', options: { Cobalt: 'cobalt', Ember: 'ember', Verdant: 'verdant', Violet: 'violet', Monochrome: 'mono' } },
  { key: 'layout', label: 'Layout', folder: 'View', kind: 'options', options: { 'Living clusters': 'clusters', 'Free force': 'force', 'Radial atlas': 'radial', 'Knowledge lattice': 'lattice' } },
  { key: 'minZoom', label: 'Min zoom', folder: 'View', kind: 'number', min: 0.35, max: 12, step: 0.05 },
  { key: 'maxZoom', label: 'Max zoom', folder: 'View', kind: 'number', min: 16, max: 180, step: 1 },
  { key: 'animations', label: 'Motion', folder: 'View', kind: 'boolean' },
  { key: 'nodeScale', label: 'Node size', folder: 'Nodes', kind: 'number', min: 0.55, max: 1.8, step: 0.01 },
  { key: 'nodeDensity', label: 'Density', folder: 'Nodes', kind: 'number', min: 0.55, max: 1.55, step: 0.01 },
  { key: 'raySteps', label: 'Volume samples', folder: 'Nodes', kind: 'number', min: 8, max: 40, step: 1 },
  { key: 'dreamFieldLayers', label: 'Field layers', folder: 'Nodes', kind: 'number', min: 1, max: 3, step: 1 },
  { key: 'dreamFieldScale', label: 'Field detail', folder: 'Nodes', kind: 'number', min: 0.6, max: 1.8, step: 0.01 },
  { key: 'dreamWarp', label: 'Shape warp', folder: 'Nodes', kind: 'number', min: 0, max: 0.42, step: 0.005 },
  { key: 'dreamJitter', label: 'Sample jitter', folder: 'Nodes', kind: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'dreamLodStrength', label: 'Small-node LOD', folder: 'Nodes', kind: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'showLabels', label: 'Selected labels', folder: 'Nodes', kind: 'boolean' },
  { key: 'edgeOpacity', label: 'Link opacity', folder: 'Links', kind: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'physicsEngine', label: 'Engine', folder: 'Physics', kind: 'options', options: { 'WebGPU force': 'webgpu', 'Box3D WASM': 'box3d' } },
  { key: 'dragInfluence', label: 'Dragged nodes influence graph', folder: 'Physics', kind: 'boolean' },
  { key: 'repulsion', label: 'Repulsion', folder: 'Physics', kind: 'number', min: 0, max: 20, step: 0.1 },
  { key: 'spring', label: 'Link spring', folder: 'Physics', kind: 'number', min: 0, max: 8, step: 0.05 },
  { key: 'springLength', label: 'Link length', folder: 'Physics', kind: 'number', min: 0.8, max: 8, step: 0.05 },
  { key: 'centering', label: 'Center gravity', folder: 'Physics', kind: 'number', min: 0, max: 1.2, step: 0.01 },
  { key: 'clusterStrength', label: 'Cluster gravity', folder: 'Physics', kind: 'number', min: 0, max: 1.5, step: 0.01 },
  { key: 'damping', label: 'Damping', folder: 'Physics', kind: 'number', min: 0.55, max: 0.98, step: 0.005 },
  { key: 'simulationSpeed', label: 'Simulation speed', folder: 'Physics', kind: 'number', min: 0.1, max: 2, step: 0.05 },
  { key: 'glow', label: 'Glow', folder: 'Effects', kind: 'number', min: 0, max: 1.6, step: 0.01 },
  { key: 'pulse', label: 'Pulse', folder: 'Effects', kind: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'resolutionScale', label: 'Resolution scale', folder: 'Performance', kind: 'number', min: 0.55, max: 1, step: 0.05 },
  { key: 'showGrid', label: 'Spatial grid', folder: 'Debug / overlays', kind: 'boolean' },
  { key: 'showLandmarks', label: 'Landmarks', folder: 'Debug / overlays', kind: 'boolean' },
  { key: 'showHelp', label: 'Control hints', folder: 'Debug / overlays', kind: 'boolean' },
];

export const SETTINGS_SCHEMA_SIGNATURE = JSON.stringify({ defaults: SETTINGS_DEFAULTS, fields: SETTING_FIELDS });

export class SettingsStore extends EventTarget {
  readonly values: AppSettings;
  private persist: PersistenceStore | null = null;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor() {
    super();
    this.values = { ...SETTINGS_DEFAULTS };
  }

  async attachPersistence(store: PersistenceStore): Promise<void> {
    this.persist = store;
    try {
      const stored = await store.loadSettings();
      if (stored?.signature === SETTINGS_SCHEMA_SIGNATURE) {
        Object.assign(this.values, SETTINGS_DEFAULTS, stored.values);
      }
    } catch (error) {
      console.warn('Failed to load persisted settings; using defaults.', error);
    }
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.values[key] = value;
    this.queuePersist();
    this.dispatchEvent(new CustomEvent('change', { detail: { key, value } }));
  }

  changed(): void {
    this.queuePersist();
    this.dispatchEvent(new CustomEvent('change', { detail: { key: null } }));
  }

  reset(): void {
    Object.assign(this.values, SETTINGS_DEFAULTS);
    this.queuePersist();
    this.dispatchEvent(new CustomEvent('reset'));
    this.dispatchEvent(new CustomEvent('change', { detail: { key: null } }));
  }

  snapshot(): StoredSettings {
    return { signature: SETTINGS_SCHEMA_SIGNATURE, values: { ...this.values } };
  }

  private queuePersist(): void {
    this.persistQueue = this.persistQueue
      .then(() => this.persistCurrent())
      .catch((error) => console.error('Failed to persist settings', error));
  }

  private async persistCurrent(): Promise<void> {
    if (!this.persist) return;
    await this.persist.saveSettings(this.snapshot());
  }
}
