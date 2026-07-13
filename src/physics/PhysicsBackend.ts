export type PhysicsNodeId = string | number;

export type PhysicsDimension = '2d' | '3d';

export type FunPhysicsPreset = 'zero-g' | 'lunar' | 'elastic';

export interface PhysicsVector3 {
  x: number;
  y: number;
  z: number;
}

export interface PhysicsNodeInput {
  id: PhysicsNodeId;
  position: PhysicsVector3;
  radius: number;
  cluster?: PhysicsNodeId;
  pinned?: boolean;
}

export interface PhysicsEdgeInput {
  source: PhysicsNodeId;
  target: PhysicsNodeId;
  /** World-space spring length. Uses `linkDistance` when omitted. */
  restLength?: number;
  /** Multiplier applied to the global link strength. */
  strength?: number;
}

export interface PhysicsGraphInput {
  nodes: readonly PhysicsNodeInput[];
  edges: readonly PhysicsEdgeInput[];
}

/**
 * Runtime-tweakable physics values. Strengths are acceleration-like, so node
 * size does not make large graph nodes disproportionately sluggish.
 */
export interface PhysicsSettings {
  dimension: PhysicsDimension;
  centerStrength: number;
  clusterStrength: number;
  linkStrength: number;
  linkDistance: number;
  linkDamping: number;
  linearDamping: number;
  angularDamping: number;
  density: number;
  friction: number;
  restitution: number;
  collisionRadiusScale: number;
  maximumAcceleration: number;
  maximumLinearSpeed: number;
  subStepCount: number;
  timeScale: number;
  maxDeltaSeconds: number;
}

export const DEFAULT_PHYSICS_SETTINGS: Readonly<PhysicsSettings> = Object.freeze({
  dimension: '2d',
  centerStrength: 0.7,
  clusterStrength: 1.5,
  linkStrength: 5.5,
  linkDistance: 3.5,
  linkDamping: 0.65,
  linearDamping: 1.25,
  angularDamping: 1,
  density: 1,
  friction: 0.08,
  restitution: 0.12,
  collisionRadiusScale: 1.08,
  maximumAcceleration: 120,
  maximumLinearSpeed: 80,
  subStepCount: 2,
  timeScale: 1,
  maxDeltaSeconds: 1 / 30,
});

export interface PhysicsBackend {
  readonly kind: string;
  readonly initialized: boolean;
  readonly nodeCount: number;

  /** Starts the runtime without creating graph bodies. Safe to call repeatedly. */
  initialize(): Promise<void>;

  /** Replaces the complete simulated graph. This is also the lazy-init boundary. */
  setGraph(graph: PhysicsGraphInput): Promise<void>;

  configure(settings: Partial<PhysicsSettings>): void;
  setDimension(dimension: PhysicsDimension): void;
  setFunPreset(preset: FunPhysicsPreset): void;
  clearFunPreset(): void;
  /** Applies a pseudo-random, deterministic outward impulse to free nodes. */
  burst(intensity: number): void;

  beginDrag(nodeId: PhysicsNodeId, target?: PhysicsVector3): void;
  updateDrag(nodeId: PhysicsNodeId, target: PhysicsVector3): void;
  endDrag(nodeId: PhysicsNodeId, releaseVelocity?: PhysicsVector3): void;
  setPinned(nodeId: PhysicsNodeId, pinned: boolean, target?: PhysicsVector3): void;
  setNodePosition(nodeId: PhysicsNodeId, position: PhysicsVector3): void;

  /**
   * Advances the world and returns a reused dense XYZ buffer in graph-node
   * order. Copy it if it needs to outlive the next backend call.
   */
  step(deltaSeconds: number): Float32Array;
  getPositions(): Float32Array;

  dispose(): void;
}
