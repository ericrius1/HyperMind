export type Vec3 = [number, number, number];

export type ViewDimension = '2d' | '3d';
export type CameraMode = 'orbit' | 'fly';
export type RenderSkinId = 'simple' | 'luminous' | 'dream';
export type LayoutId = 'force' | 'radial' | 'clusters' | 'lattice';
export type PaletteId = 'cobalt' | 'ember' | 'verdant' | 'violet' | 'mono';
export type PhysicsEngineId = 'webgpu' | 'box3d';

export interface GraphNode {
  id: string;
  title: string;
  description: string;
  cluster: number;
  position: Vec3;
  radius: number;
  tags: string[];
  subcluster?: string;
  portal?: ScenePortal;
  pinned?: boolean;
}

export interface ScenePortal {
  scene: string;
  focus?: string;
  label: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  strength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SceneSubcluster {
  id: string;
  label: string;
  cluster: number;
  description: string;
}

export interface GraphScene {
  id: string;
  title: string;
  shortTitle: string;
  kicker: string;
  description: string;
  palette: PaletteId;
  layout: LayoutId;
  graph: GraphData;
  clusterLabels: string[];
  subclusters: SceneSubcluster[];
  sources?: string[];
}

export interface Palette {
  id: PaletteId;
  label: string;
  background: [number, number, number, number];
  surface: [number, number, number];
  accent: [number, number, number];
  clusters: Array<[number, number, number, number]>;
}

export const NODE_STRIDE = 64;
export const EDGE_STRIDE = 32;
export const MAX_NODES = 256;
export const MAX_EDGES = 1024;

export const NodeFlags = {
  Selected: 1,
  Pinned: 2,
  Dragging: 4,
  Isolated: 8,
} as const;
