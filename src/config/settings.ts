import type { CameraMode, LayoutId, PaletteId, PhysicsEngineId, RenderSkinId, ViewDimension } from '../core/types';

export interface AppSettings {
  dimension: ViewDimension;
  cameraMode: CameraMode;
  skin: RenderSkinId;
  palette: PaletteId;
  layout: LayoutId;
  physicsEngine: PhysicsEngineId;
  animations: boolean;
  dragInfluence: boolean;
  nodeScale: number;
  nodeDensity: number;
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
  animations: true,
  dragInfluence: true,
  nodeScale: 1,
  nodeDensity: 1,
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
  raySteps: 18,
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
  { key: 'animations', label: 'Motion', folder: 'View', kind: 'boolean' },
  { key: 'nodeScale', label: 'Node size', folder: 'Nodes', kind: 'number', min: 0.55, max: 1.8, step: 0.01 },
  { key: 'nodeDensity', label: 'Density', folder: 'Nodes', kind: 'number', min: 0.55, max: 1.55, step: 0.01 },
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
  { key: 'raySteps', label: 'Dream ray steps', folder: 'Performance', kind: 'number', min: 8, max: 24, step: 1 },
  { key: 'resolutionScale', label: 'Resolution scale', folder: 'Performance', kind: 'number', min: 0.55, max: 1, step: 0.05 },
  { key: 'showGrid', label: 'Spatial grid', folder: 'Debug / overlays', kind: 'boolean' },
  { key: 'showLandmarks', label: 'Landmarks', folder: 'Debug / overlays', kind: 'boolean' },
  { key: 'showHelp', label: 'Control hints', folder: 'Debug / overlays', kind: 'boolean' },
];

const STORAGE_KEY = 'hypermind.settings';
const SCHEMA_SIGNATURE = JSON.stringify({ defaults: SETTINGS_DEFAULTS, fields: SETTING_FIELDS });

interface StoredSettings {
  signature: string;
  values: AppSettings;
}

export class SettingsStore extends EventTarget {
  readonly values: AppSettings;

  constructor() {
    super();
    this.values = this.load();
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.values[key] = value;
    this.persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { key, value } }));
  }

  changed(): void {
    this.persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { key: null } }));
  }

  reset(): void {
    Object.assign(this.values, SETTINGS_DEFAULTS);
    this.persist();
    this.dispatchEvent(new CustomEvent('reset'));
    this.dispatchEvent(new CustomEvent('change', { detail: { key: null } }));
  }

  private load(): AppSettings {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as StoredSettings;
      if (stored.signature === SCHEMA_SIGNATURE) return { ...SETTINGS_DEFAULTS, ...stored.values };
    } catch {
      // A single current schema is intentional; malformed or old values reset.
    }
    return { ...SETTINGS_DEFAULTS };
  }

  private persist(): void {
    const stored: StoredSettings = { signature: SCHEMA_SIGNATURE, values: this.values };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }
}
