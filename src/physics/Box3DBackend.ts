import type {
  Box3DModule,
  b3BodyId,
  b3JointId,
  b3ShapeId,
  b3WorldId,
} from 'box3d.js/inline';

import {
  DEFAULT_PHYSICS_SETTINGS,
  type FunPhysicsPreset,
  type PhysicsBackend,
  type PhysicsDimension,
  type PhysicsEdgeInput,
  type PhysicsGraphInput,
  type PhysicsNodeId,
  type PhysicsNodeInput,
  type PhysicsSettings,
  type PhysicsVector3,
} from './PhysicsBackend';

const ZERO = { x: 0, y: 0, z: 0 } as const;
const IDENTITY_QUATERNION = {
  v: { x: 0, y: 0, z: 0 },
  s: 1,
} as const;
const MIN_RADIUS = 0.01;
const MIN_STEP_SECONDS = 1e-6;

interface ResolvedEdge {
  sourceIndex: number;
  targetIndex: number;
  restLength?: number;
  strength: number;
  jointId?: b3JointId;
}

interface FunPresetDefinition {
  gravity: PhysicsVector3;
  settings: Partial<PhysicsSettings>;
  jointHertz: number;
  cableLimitScale: number | null;
}

interface BodyEntry {
  readonly id: PhysicsNodeId;
  readonly bodyId: b3BodyId;
  readonly shapeId: b3ShapeId;
  readonly radius: number;
  mass: number;
  pinned: boolean;
  pinTarget: PhysicsVector3 | null;
  dragTarget: PhysicsVector3 | null;
}

const FUN_PRESETS: Readonly<Record<FunPhysicsPreset, FunPresetDefinition>> = {
  'zero-g': {
    gravity: { x: 0, y: 0, z: 0 },
    settings: {
      centerStrength: 0.025,
      clusterStrength: 0.08,
      linkStrength: 1.4,
      linkDistance: 4,
      linkDamping: 0.18,
      linearDamping: 0.06,
      angularDamping: 0.1,
      friction: 0.02,
      restitution: 0.42,
    },
    jointHertz: 0.6,
    cableLimitScale: 1.35,
  },
  lunar: {
    gravity: { x: 0, y: -1.62, z: 0 },
    settings: {
      centerStrength: 0.18,
      clusterStrength: 0.22,
      linkStrength: 0.9,
      linkDistance: 4.5,
      linkDamping: 0.32,
      linearDamping: 0.16,
      angularDamping: 0.18,
      friction: 0.04,
      restitution: 0.82,
    },
    jointHertz: 0.42,
    cableLimitScale: null,
  },
  elastic: {
    gravity: { x: 0, y: 0, z: 0 },
    settings: {
      centerStrength: 0.3,
      clusterStrength: 0.8,
      linkStrength: 13,
      linkDistance: 3.25,
      linkDamping: 0.9,
      linearDamping: 0.45,
      angularDamping: 0.5,
      friction: 0.02,
      restitution: 0.62,
    },
    jointHertz: 3.2,
    cableLimitScale: null,
  },
};

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function positiveOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sanitizedVector(value: PhysicsVector3, dimension: PhysicsDimension): PhysicsVector3 {
  return {
    x: finiteOr(value.x, 0),
    y: finiteOr(value.y, 0),
    z: dimension === '2d' ? 0 : finiteOr(value.z, 0),
  };
}

/** CPU/WASM graph physics powered by the browser-inline box3d.js build. */
export class Box3DBackend implements PhysicsBackend {
  readonly kind = 'box3d-wasm';

  private modulePromise: Promise<Box3DModule> | null = null;
  private b3: Box3DModule | null = null;
  private worldId: b3WorldId | null = null;
  private settings: PhysicsSettings;
  private bodies: BodyEntry[] = [];
  private edges: ResolvedEdge[] = [];
  private clusterMembers: number[][] = [];
  private indexById = new Map<PhysicsNodeId, number>();
  private positions = new Float32Array(0);
  private velocities = new Float32Array(0);
  private forces = new Float32Array(0);
  private funPreset: FunPhysicsPreset | null = null;
  private burstCount = 0;

  constructor(settings: Partial<PhysicsSettings> = {}) {
    this.settings = this.normalizeSettings({
      ...DEFAULT_PHYSICS_SETTINGS,
      ...settings,
    });
  }

  get initialized(): boolean {
    return this.b3 !== null;
  }

  get nodeCount(): number {
    return this.bodies.length;
  }

  async initialize(): Promise<void> {
    if (!this.modulePromise) {
      this.modulePromise = import('box3d.js/inline').then(({ default: createBox3D }) => createBox3D());
    }

    this.b3 = await this.modulePromise;
  }

  async setGraph(graph: PhysicsGraphInput): Promise<void> {
    await this.initialize();
    const b3 = this.requireModule();

    this.destroyWorld();

    const worldDef = b3.b3DefaultWorldDef();
    worldDef.gravity = this.funPreset
      ? { ...FUN_PRESETS[this.funPreset].gravity }
      : { ...ZERO };
    worldDef.maximumLinearSpeed = this.settings.maximumLinearSpeed;
    worldDef.enableSleep = true;
    this.worldId = b3.b3CreateWorld(worldDef);

    this.indexById = new Map();
    this.bodies = [];
    this.positions = new Float32Array(graph.nodes.length * 3);
    this.velocities = new Float32Array(graph.nodes.length * 3);
    this.forces = new Float32Array(graph.nodes.length * 3);

    for (let index = 0; index < graph.nodes.length; index += 1) {
      const node = graph.nodes[index];
      if (!node) continue;
      if (this.indexById.has(node.id)) {
        throw new Error(`Duplicate physics node id: ${String(node.id)}`);
      }

      this.indexById.set(node.id, index);
      this.bodies.push(this.createBody(node));
    }

    this.edges = this.resolveEdges(graph.edges);
    this.clusterMembers = this.resolveClusters(graph.nodes);
    this.ensureDistanceJoints();
    this.retuneDistanceJoints();
    this.burstCount = 0;
    this.readPositions();
  }

  configure(changes: Partial<PhysicsSettings>): void {
    const previous = this.settings;
    this.settings = this.normalizeSettings({ ...this.settings, ...changes });

    if (!this.b3 || !this.worldId) return;

    this.b3.b3World_SetMaximumLinearSpeed(
      this.worldId,
      this.settings.maximumLinearSpeed,
    );

    const dimensionChanged = previous.dimension !== this.settings.dimension;
    const radiusScaleChanged =
      previous.collisionRadiusScale !== this.settings.collisionRadiusScale;
    const materialChanged =
      previous.density !== this.settings.density ||
      previous.friction !== this.settings.friction ||
      previous.restitution !== this.settings.restitution;
    const jointsChanged =
      previous.linkStrength !== this.settings.linkStrength ||
      previous.linkDistance !== this.settings.linkDistance ||
      previous.linkDamping !== this.settings.linkDamping ||
      previous.collisionRadiusScale !== this.settings.collisionRadiusScale;

    for (const entry of this.bodies) {
      this.b3.b3Body_SetLinearDamping(entry.bodyId, this.settings.linearDamping);
      this.b3.b3Body_SetAngularDamping(entry.bodyId, this.settings.angularDamping);

      if (dimensionChanged) this.applyDimension(entry);

      if (radiusScaleChanged) {
        this.b3.b3Shape_SetSphere(entry.shapeId, {
          center: { ...ZERO },
          radius: entry.radius * this.settings.collisionRadiusScale,
        });
      }

      if (materialChanged) {
        const material = this.b3.b3Shape_GetSurfaceMaterial(entry.shapeId);
        material.friction = this.settings.friction;
        material.restitution = this.settings.restitution;
        this.b3.b3Shape_SetSurfaceMaterial(entry.shapeId, material);
        this.b3.b3Shape_SetDensity(entry.shapeId, this.settings.density, true);
      } else if (radiusScaleChanged) {
        this.b3.b3Body_ApplyMassFromShapes(entry.bodyId);
      }

      if (materialChanged || radiusScaleChanged) {
        entry.mass = Math.max(this.b3.b3Body_GetMass(entry.bodyId), 1e-6);
      }
    }

    if (jointsChanged && this.funPreset) {
      if (this.settings.linkStrength <= 0) {
        this.destroyDistanceJoints();
      } else {
        this.ensureDistanceJoints();
        this.retuneDistanceJoints();
      }
    }

    this.readPositions();
  }

  setDimension(dimension: PhysicsDimension): void {
    this.configure({ dimension });
  }

  setFunPreset(preset: FunPhysicsPreset): void {
    this.funPreset = preset;
    const definition = FUN_PRESETS[preset];
    this.configure(definition.settings);

    if (!this.b3 || !this.worldId) return;
    this.b3.b3World_SetGravity(this.worldId, { ...definition.gravity });
    this.ensureDistanceJoints();
    this.retuneDistanceJoints();
    for (const entry of this.bodies) {
      this.b3.b3Body_SetAwake(entry.bodyId, true);
    }
  }

  clearFunPreset(): void {
    this.funPreset = null;
    this.destroyDistanceJoints();
    if (this.b3 && this.worldId) this.b3.b3World_SetGravity(this.worldId, { ...ZERO });
  }

  burst(intensity: number): void {
    if (!this.b3 || !this.worldId) return;
    const magnitude = Math.max(0, finiteOr(intensity, 0));
    if (magnitude <= 0) return;

    this.readPositions();
    const burstSeed = this.burstCount;
    this.burstCount += 1;

    for (let index = 0; index < this.bodies.length; index += 1) {
      const entry = this.bodies[index];
      if (!entry || entry.pinned || entry.dragTarget) continue;
      const offset = index * 3;
      const random = this.burstDirection(entry.id, index, burstSeed);
      let x = (this.positions[offset] ?? 0) * 0.65 + random.x;
      let y = (this.positions[offset + 1] ?? 0) * 0.65 + random.y;
      let z =
        this.settings.dimension === '2d'
          ? 0
          : (this.positions[offset + 2] ?? 0) * 0.65 + random.z;
      const inverseLength = 1 / Math.max(Math.hypot(x, y, z), 1e-6);
      x *= inverseLength;
      y *= inverseLength;
      z *= inverseLength;

      const variation =
        0.8 + this.seededUnit(entry.id, index, burstSeed, 3) * 0.4;
      const impulse = entry.mass * magnitude * variation;
      this.b3.b3Body_ApplyLinearImpulseToCenter(
        entry.bodyId,
        { x: x * impulse, y: y * impulse, z: z * impulse },
        true,
      );
    }
  }

  beginDrag(nodeId: PhysicsNodeId, target?: PhysicsVector3): void {
    const entry = this.getEntry(nodeId);
    const nextTarget = target ?? this.getBodyPosition(entry);
    entry.dragTarget = sanitizedVector(nextTarget, this.settings.dimension);
    this.setKinematic(entry);
  }

  updateDrag(nodeId: PhysicsNodeId, target: PhysicsVector3): void {
    const entry = this.getEntry(nodeId);
    entry.dragTarget = sanitizedVector(target, this.settings.dimension);
    this.setKinematic(entry);
  }

  endDrag(nodeId: PhysicsNodeId, releaseVelocity: PhysicsVector3 = ZERO): void {
    const entry = this.getEntry(nodeId);
    if (entry.pinned && entry.dragTarget) entry.pinTarget = entry.dragTarget;
    entry.dragTarget = null;

    if (entry.pinned) {
      this.setKinematic(entry);
      return;
    }

    this.setDynamic(entry, releaseVelocity);
  }

  setPinned(
    nodeId: PhysicsNodeId,
    pinned: boolean,
    target?: PhysicsVector3,
  ): void {
    const entry = this.getEntry(nodeId);
    entry.pinned = pinned;

    if (pinned) {
      const nextTarget = target ?? entry.dragTarget ?? this.getBodyPosition(entry);
      entry.pinTarget = sanitizedVector(nextTarget, this.settings.dimension);
      this.setKinematic(entry);
    } else {
      entry.pinTarget = null;
      if (!entry.dragTarget) this.setDynamic(entry, ZERO);
    }
  }

  setNodePosition(nodeId: PhysicsNodeId, position: PhysicsVector3): void {
    const entry = this.getEntry(nodeId);
    const nextPosition = sanitizedVector(position, this.settings.dimension);
    const b3 = this.requireModule();
    b3.b3Body_SetTransform(entry.bodyId, nextPosition, IDENTITY_QUATERNION);
    b3.b3Body_SetLinearVelocity(entry.bodyId, { ...ZERO });
    b3.b3Body_SetAngularVelocity(entry.bodyId, { ...ZERO });

    if (entry.dragTarget) entry.dragTarget = nextPosition;
    if (entry.pinned) entry.pinTarget = nextPosition;
    this.writePosition(this.indexById.get(nodeId) ?? -1, nextPosition);
  }

  step(deltaSeconds: number): Float32Array {
    if (!this.b3 || !this.worldId || this.bodies.length === 0) {
      return this.positions;
    }

    const dt =
      Math.min(
        Math.max(0, finiteOr(deltaSeconds, 0)),
        this.settings.maxDeltaSeconds,
      ) * this.settings.timeScale;

    if (dt < MIN_STEP_SECONDS) return this.getPositions();

    this.readPositions();
    this.applyGraphForces();
    this.updateKinematicTargets(dt);
    this.b3.b3World_Step(this.worldId, dt, this.settings.subStepCount);
    return this.readPositions();
  }

  getPositions(): Float32Array {
    if (this.b3 && this.worldId) this.readPositions();
    return this.positions;
  }

  dispose(): void {
    this.destroyWorld();
    this.edges = [];
    this.clusterMembers = [];
    this.indexById.clear();
    this.positions = new Float32Array(0);
    this.velocities = new Float32Array(0);
    this.forces = new Float32Array(0);
  }

  private createBody(node: PhysicsNodeInput): BodyEntry {
    const b3 = this.requireModule();
    const worldId = this.requireWorld();
    const position = sanitizedVector(node.position, this.settings.dimension);
    const radius = positiveOr(node.radius, MIN_RADIUS);

    const bodyDef = b3.b3DefaultBodyDef();
    bodyDef.type = node.pinned
      ? b3.b3BodyType.b3_kinematicBody
      : b3.b3BodyType.b3_dynamicBody;
    bodyDef.position = position;
    bodyDef.linearDamping = this.settings.linearDamping;
    bodyDef.angularDamping = this.settings.angularDamping;
    bodyDef.motionLocks = this.motionLocks();
    bodyDef.enableSleep = true;
    const bodyId = b3.b3CreateBody(worldId, bodyDef);

    const shapeDef = b3.b3DefaultShapeDef();
    shapeDef.density = this.settings.density;
    shapeDef.baseMaterial.friction = this.settings.friction;
    shapeDef.baseMaterial.restitution = this.settings.restitution;
    shapeDef.updateBodyMass = true;
    const shapeId = b3.b3CreateSphereShape(bodyId, shapeDef, {
      center: { ...ZERO },
      radius: radius * this.settings.collisionRadiusScale,
    });

    return {
      id: node.id,
      bodyId,
      shapeId,
      radius,
      mass: Math.max(b3.b3Body_GetMass(bodyId), 1e-6),
      pinned: node.pinned ?? false,
      pinTarget: node.pinned ? position : null,
      dragTarget: null,
    };
  }

  private resolveEdges(edges: readonly PhysicsEdgeInput[]): ResolvedEdge[] {
    const resolved: ResolvedEdge[] = [];

    for (const edge of edges) {
      const sourceIndex = this.indexById.get(edge.source);
      const targetIndex = this.indexById.get(edge.target);
      if (
        sourceIndex === undefined ||
        targetIndex === undefined ||
        sourceIndex === targetIndex
      ) {
        continue;
      }

      resolved.push({
        sourceIndex,
        targetIndex,
        restLength:
          edge.restLength === undefined
            ? undefined
            : positiveOr(edge.restLength, this.settings.linkDistance),
        strength: Math.max(0, finiteOr(edge.strength ?? 1, 1)),
      });
    }

    return resolved;
  }

  private resolveClusters(nodes: readonly PhysicsNodeInput[]): number[][] {
    const clusters = new Map<PhysicsNodeId, number[]>();

    for (let index = 0; index < nodes.length; index += 1) {
      const cluster = nodes[index]?.cluster;
      if (cluster === undefined) continue;
      const members = clusters.get(cluster) ?? [];
      members.push(index);
      clusters.set(cluster, members);
    }

    return [...clusters.values()].filter((members) => members.length > 1);
  }

  private applyGraphForces(): void {
    const b3 = this.requireModule();
    this.forces.fill(0);

    for (let index = 0; index < this.bodies.length; index += 1) {
      const offset = index * 3;
      this.forces[offset] = -(this.positions[offset] ?? 0) * this.settings.centerStrength;
      this.forces[offset + 1] =
        -(this.positions[offset + 1] ?? 0) * this.settings.centerStrength;
      this.forces[offset + 2] =
        this.settings.dimension === '2d'
          ? 0
          : -(this.positions[offset + 2] ?? 0) * this.settings.centerStrength;
    }

    this.applyClusterForces();
    if (
      this.edges.some((edge) => !edge.jointId && edge.strength > 0) &&
      this.settings.linkStrength > 0 &&
      this.settings.linkDamping > 0
    ) {
      this.readVelocities();
    }
    this.applyLinkForces();

    const maxAccelerationSquared = this.settings.maximumAcceleration ** 2;
    for (let index = 0; index < this.bodies.length; index += 1) {
      const entry = this.bodies[index];
      if (!entry || entry.pinned || entry.dragTarget) continue;

      const offset = index * 3;
      let x = this.forces[offset] ?? 0;
      let y = this.forces[offset + 1] ?? 0;
      let z = this.settings.dimension === '2d' ? 0 : (this.forces[offset + 2] ?? 0);
      const lengthSquared = x * x + y * y + z * z;
      if (lengthSquared < 1e-10) continue;

      if (lengthSquared > maxAccelerationSquared) {
        const scale = this.settings.maximumAcceleration / Math.sqrt(lengthSquared);
        x *= scale;
        y *= scale;
        z *= scale;
      }

      b3.b3Body_ApplyForceToCenter(
        entry.bodyId,
        { x: x * entry.mass, y: y * entry.mass, z: z * entry.mass },
        true,
      );
    }
  }

  private applyClusterForces(): void {
    const strength = this.settings.clusterStrength;
    if (strength <= 0) return;

    for (const members of this.clusterMembers) {
      let centerX = 0;
      let centerY = 0;
      let centerZ = 0;

      for (const index of members) {
        const offset = index * 3;
        centerX += this.positions[offset] ?? 0;
        centerY += this.positions[offset + 1] ?? 0;
        centerZ += this.positions[offset + 2] ?? 0;
      }

      const inverseCount = 1 / members.length;
      centerX *= inverseCount;
      centerY *= inverseCount;
      centerZ *= inverseCount;

      for (const index of members) {
        const offset = index * 3;
        this.forces[offset] =
          (this.forces[offset] ?? 0) +
          (centerX - (this.positions[offset] ?? 0)) * strength;
        this.forces[offset + 1] =
          (this.forces[offset + 1] ?? 0) +
          (centerY - (this.positions[offset + 1] ?? 0)) * strength;
        if (this.settings.dimension === '3d') {
          this.forces[offset + 2] =
            (this.forces[offset + 2] ?? 0) +
            (centerZ - (this.positions[offset + 2] ?? 0)) * strength;
        }
      }
    }
  }

  private applyLinkForces(): void {
    const springStrength = this.settings.linkStrength;
    if (springStrength <= 0) return;

    for (const edge of this.edges) {
      if (edge.jointId) continue;
      const sourceOffset = edge.sourceIndex * 3;
      const targetOffset = edge.targetIndex * 3;
      const dx =
        (this.positions[targetOffset] ?? 0) - (this.positions[sourceOffset] ?? 0);
      const dy =
        (this.positions[targetOffset + 1] ?? 0) -
        (this.positions[sourceOffset + 1] ?? 0);
      const dz =
        this.settings.dimension === '2d'
          ? 0
          : (this.positions[targetOffset + 2] ?? 0) -
            (this.positions[sourceOffset + 2] ?? 0);
      const distance = Math.hypot(dx, dy, dz);
      if (distance < 1e-5) continue;

      const inverseDistance = 1 / distance;
      const nx = dx * inverseDistance;
      const ny = dy * inverseDistance;
      const nz = dz * inverseDistance;
      const sourceEntry = this.bodies[edge.sourceIndex];
      const targetEntry = this.bodies[edge.targetIndex];
      if (!sourceEntry || !targetEntry) continue;

      const restLength = Math.max(
        (sourceEntry.radius + targetEntry.radius) * this.settings.collisionRadiusScale,
        edge.restLength ?? this.settings.linkDistance,
      );
      let acceleration = (distance - restLength) * springStrength * edge.strength;

      if (this.settings.linkDamping > 0) {
        const relativeVelocity =
          ((this.velocities[targetOffset] ?? 0) -
            (this.velocities[sourceOffset] ?? 0)) *
            nx +
          ((this.velocities[targetOffset + 1] ?? 0) -
            (this.velocities[sourceOffset + 1] ?? 0)) *
            ny +
          ((this.velocities[targetOffset + 2] ?? 0) -
            (this.velocities[sourceOffset + 2] ?? 0)) *
            nz;
        acceleration -= relativeVelocity * this.settings.linkDamping;
      }

      this.forces[sourceOffset] =
        (this.forces[sourceOffset] ?? 0) + nx * acceleration;
      this.forces[sourceOffset + 1] =
        (this.forces[sourceOffset + 1] ?? 0) + ny * acceleration;
      this.forces[sourceOffset + 2] =
        (this.forces[sourceOffset + 2] ?? 0) + nz * acceleration;
      this.forces[targetOffset] =
        (this.forces[targetOffset] ?? 0) - nx * acceleration;
      this.forces[targetOffset + 1] =
        (this.forces[targetOffset + 1] ?? 0) - ny * acceleration;
      this.forces[targetOffset + 2] =
        (this.forces[targetOffset + 2] ?? 0) - nz * acceleration;
    }
  }

  private ensureDistanceJoints(): void {
    if (
      !this.b3 ||
      !this.worldId ||
      !this.funPreset ||
      this.settings.linkStrength <= 0
    ) {
      return;
    }

    for (const edge of this.edges) {
      if (edge.strength <= 0) continue;
      if (edge.jointId && this.b3.b3Joint_IsValid(edge.jointId)) continue;
      const source = this.bodies[edge.sourceIndex];
      const target = this.bodies[edge.targetIndex];
      if (!source || !target) continue;

      const definition = this.b3.b3DefaultDistanceJointDef();
      definition.base.bodyIdA = source.bodyId;
      definition.base.bodyIdB = target.bodyId;
      definition.base.localFrameA = {
        p: { ...ZERO },
        q: IDENTITY_QUATERNION,
      };
      definition.base.localFrameB = {
        p: { ...ZERO },
        q: IDENTITY_QUATERNION,
      };
      definition.base.collideConnected = true;
      definition.length = this.edgeRestLength(edge);
      definition.enableSpring = true;
      definition.hertz = this.edgeJointHertz(edge);
      definition.dampingRatio = this.jointDampingRatio();
      edge.jointId = this.b3.b3CreateDistanceJoint(this.worldId, definition);
    }
  }

  private retuneDistanceJoints(): void {
    if (!this.b3 || !this.funPreset) return;
    const preset = FUN_PRESETS[this.funPreset];

    for (const edge of this.edges) {
      const jointId = edge.jointId;
      if (!jointId || !this.b3.b3Joint_IsValid(jointId)) continue;
      const restLength = this.edgeRestLength(edge);
      this.b3.b3DistanceJoint_EnableSpring(jointId, true);
      this.b3.b3DistanceJoint_SetLength(jointId, restLength);
      this.b3.b3DistanceJoint_SetSpringHertz(
        jointId,
        this.edgeJointHertz(edge),
      );
      this.b3.b3DistanceJoint_SetSpringDampingRatio(
        jointId,
        this.jointDampingRatio(),
      );

      const cableScale = preset.cableLimitScale;
      this.b3.b3DistanceJoint_EnableLimit(jointId, cableScale !== null);
      if (cableScale !== null) {
        const source = this.bodies[edge.sourceIndex];
        const target = this.bodies[edge.targetIndex];
        if (!source || !target) continue;
        const minimumLength = Math.max(
          MIN_RADIUS,
          (source.radius + target.radius) * this.settings.collisionRadiusScale,
        );
        this.b3.b3DistanceJoint_SetLengthRange(
          jointId,
          Math.min(minimumLength, restLength),
          Math.max(restLength, minimumLength) * cableScale,
        );
      }
    }
  }

  private destroyDistanceJoints(): void {
    if (!this.b3) return;
    for (const edge of this.edges) {
      if (edge.jointId && this.b3.b3Joint_IsValid(edge.jointId)) {
        this.b3.b3DestroyJoint(edge.jointId, true);
      }
      delete edge.jointId;
    }
  }

  private edgeRestLength(edge: ResolvedEdge): number {
    const source = this.bodies[edge.sourceIndex];
    const target = this.bodies[edge.targetIndex];
    const collisionLength =
      source && target
        ? (source.radius + target.radius) * this.settings.collisionRadiusScale
        : MIN_RADIUS;
    return Math.max(
      collisionLength,
      edge.restLength ?? this.settings.linkDistance,
      MIN_RADIUS,
    );
  }

  private edgeJointHertz(edge: ResolvedEdge): number {
    if (!this.funPreset) return 0;
    const preset = FUN_PRESETS[this.funPreset];
    const presetStrength = positiveOr(preset.settings.linkStrength ?? 1, 1);
    const strengthScale = Math.sqrt(this.settings.linkStrength / presetStrength);
    return Math.max(
      0.01,
      preset.jointHertz * strengthScale * Math.sqrt(edge.strength),
    );
  }

  private jointDampingRatio(): number {
    return Math.min(2, Math.max(0.01, this.settings.linkDamping));
  }

  private burstDirection(
    nodeId: PhysicsNodeId,
    nodeIndex: number,
    burstIndex: number,
  ): PhysicsVector3 {
    const u = this.seededUnit(nodeId, nodeIndex, burstIndex, 0);
    if (this.settings.dimension === '2d') {
      const angle = u * Math.PI * 2;
      return { x: Math.cos(angle), y: Math.sin(angle), z: 0 };
    }

    const v = this.seededUnit(nodeId, nodeIndex, burstIndex, 1);
    const z = u * 2 - 1;
    const radial = Math.sqrt(Math.max(0, 1 - z * z));
    const angle = v * Math.PI * 2;
    return {
      x: radial * Math.cos(angle),
      y: radial * Math.sin(angle),
      z,
    };
  }

  private seededUnit(
    nodeId: PhysicsNodeId,
    nodeIndex: number,
    burstIndex: number,
    channel: number,
  ): number {
    const key = `${typeof nodeId}:${String(nodeId)}:${nodeIndex}:${burstIndex}:${channel}`;
    let hash = 2_166_136_261;
    for (let index = 0; index < key.length; index += 1) {
      hash ^= key.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 2_246_822_507);
    hash ^= hash >>> 13;
    return (hash >>> 0) / 4_294_967_296;
  }

  private updateKinematicTargets(deltaSeconds: number): void {
    const b3 = this.requireModule();

    for (const entry of this.bodies) {
      const target = entry.dragTarget ?? entry.pinTarget;
      if (!target) continue;
      const constrainedTarget = sanitizedVector(target, this.settings.dimension);
      b3.b3Body_SetTargetTransform(
        entry.bodyId,
        { p: constrainedTarget, q: IDENTITY_QUATERNION },
        deltaSeconds,
        true,
      );
    }
  }

  private applyDimension(entry: BodyEntry): void {
    const b3 = this.requireModule();
    b3.b3Body_SetMotionLocks(entry.bodyId, this.motionLocks());

    if (this.settings.dimension === '2d') {
      const position = b3.b3Body_GetPosition(entry.bodyId);
      b3.b3Body_SetTransform(
        entry.bodyId,
        { x: position.x, y: position.y, z: 0 },
        IDENTITY_QUATERNION,
      );
      const velocity = b3.b3Body_GetLinearVelocity(entry.bodyId);
      b3.b3Body_SetLinearVelocity(entry.bodyId, {
        x: velocity.x,
        y: velocity.y,
        z: 0,
      });
      b3.b3Body_SetAngularVelocity(entry.bodyId, { ...ZERO });
      if (entry.pinTarget) entry.pinTarget.z = 0;
      if (entry.dragTarget) entry.dragTarget.z = 0;
    }
  }

  private motionLocks() {
    const planar = this.settings.dimension === '2d';
    return {
      linearX: false,
      linearY: false,
      linearZ: planar,
      angularX: planar,
      angularY: planar,
      angularZ: planar,
    };
  }

  private setKinematic(entry: BodyEntry): void {
    const b3 = this.requireModule();
    b3.b3Body_SetType(entry.bodyId, b3.b3BodyType.b3_kinematicBody);
    b3.b3Body_SetAngularVelocity(entry.bodyId, { ...ZERO });
    b3.b3Body_SetAwake(entry.bodyId, true);
  }

  private setDynamic(entry: BodyEntry, velocity: PhysicsVector3): void {
    const b3 = this.requireModule();
    b3.b3Body_SetType(entry.bodyId, b3.b3BodyType.b3_dynamicBody);
    b3.b3Body_SetLinearVelocity(
      entry.bodyId,
      sanitizedVector(velocity, this.settings.dimension),
    );
    b3.b3Body_SetAngularVelocity(entry.bodyId, { ...ZERO });
    b3.b3Body_SetAwake(entry.bodyId, true);
  }

  private readPositions(): Float32Array {
    const b3 = this.requireModule();
    for (let index = 0; index < this.bodies.length; index += 1) {
      const entry = this.bodies[index];
      if (!entry) continue;
      this.writePosition(index, b3.b3Body_GetPosition(entry.bodyId));
    }
    return this.positions;
  }

  private readVelocities(): void {
    if (this.settings.linkDamping <= 0) return;
    const b3 = this.requireModule();
    for (let index = 0; index < this.bodies.length; index += 1) {
      const entry = this.bodies[index];
      if (!entry) continue;
      const velocity = b3.b3Body_GetLinearVelocity(entry.bodyId);
      const offset = index * 3;
      this.velocities[offset] = velocity.x;
      this.velocities[offset + 1] = velocity.y;
      this.velocities[offset + 2] = velocity.z;
    }
  }

  private writePosition(index: number, position: PhysicsVector3): void {
    if (index < 0) return;
    const offset = index * 3;
    this.positions[offset] = position.x;
    this.positions[offset + 1] = position.y;
    this.positions[offset + 2] =
      this.settings.dimension === '2d' ? 0 : position.z;
  }

  private getBodyPosition(entry: BodyEntry): PhysicsVector3 {
    return sanitizedVector(
      this.requireModule().b3Body_GetPosition(entry.bodyId),
      this.settings.dimension,
    );
  }

  private getEntry(nodeId: PhysicsNodeId): BodyEntry {
    const index = this.indexById.get(nodeId);
    const entry = index === undefined ? undefined : this.bodies[index];
    if (!entry) throw new Error(`Unknown physics node id: ${String(nodeId)}`);
    return entry;
  }

  private destroyWorld(): void {
    if (this.b3 && this.worldId && this.b3.b3World_IsValid(this.worldId)) {
      this.b3.b3DestroyWorld(this.worldId);
    }
    this.worldId = null;
    this.bodies = [];
    this.edges = [];
  }

  private requireModule(): Box3DModule {
    if (!this.b3) {
      throw new Error('Box3DBackend is not initialized. Await initialize() or setGraph().');
    }
    return this.b3;
  }

  private requireWorld(): b3WorldId {
    if (!this.worldId) throw new Error('Box3D graph world has not been created.');
    return this.worldId;
  }

  private normalizeSettings(settings: PhysicsSettings): PhysicsSettings {
    return {
      dimension: settings.dimension === '3d' ? '3d' : '2d',
      centerStrength: Math.max(0, finiteOr(settings.centerStrength, 0)),
      clusterStrength: Math.max(0, finiteOr(settings.clusterStrength, 0)),
      linkStrength: Math.max(0, finiteOr(settings.linkStrength, 0)),
      linkDistance: positiveOr(settings.linkDistance, 1),
      linkDamping: Math.max(0, finiteOr(settings.linkDamping, 0)),
      linearDamping: Math.max(0, finiteOr(settings.linearDamping, 0)),
      angularDamping: Math.max(0, finiteOr(settings.angularDamping, 0)),
      density: positiveOr(settings.density, 1),
      friction: Math.max(0, finiteOr(settings.friction, 0)),
      restitution: Math.max(0, finiteOr(settings.restitution, 0)),
      collisionRadiusScale: positiveOr(settings.collisionRadiusScale, 1),
      maximumAcceleration: positiveOr(settings.maximumAcceleration, 1),
      maximumLinearSpeed: positiveOr(settings.maximumLinearSpeed, 1),
      subStepCount: Math.max(1, Math.round(finiteOr(settings.subStepCount, 1))),
      timeScale: Math.max(0, finiteOr(settings.timeScale, 1)),
      maxDeltaSeconds: positiveOr(settings.maxDeltaSeconds, 1 / 30),
    };
  }
}

export default Box3DBackend;
