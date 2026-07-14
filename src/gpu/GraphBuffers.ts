import { PALETTES } from '../config/palettes';
import type { AppSettings } from '../config/settings';
import { EDGE_STRIDE, MAX_EDGES, MAX_NODES, NODE_STRIDE, type GraphNode, type Vec3 } from '../core/types';
import type { GraphStore } from '../data/GraphStore';

export const EDGE_FLAG_CROSS_REGION = 1;

export function edgeRegionFlags(sourceCluster: number, targetCluster: number): number {
  return sourceCluster === targetCluster ? 0 : EDGE_FLAG_CROSS_REGION;
}

export class GraphBuffers {
  readonly nodeBuffers: [GPUBuffer, GPUBuffer];
  readonly edgeBuffer: GPUBuffer;
  readonly sceneUniformBuffer: GPUBuffer;
  readonly simUniformBuffer: GPUBuffer;
  current = 0 as 0 | 1;
  nodeCount = 0;
  edgeCount = 0;
  private readonly device: GPUDevice;
  private readonly store: GraphStore;
  private readonly nodeData = new Float32Array(MAX_NODES * (NODE_STRIDE / 4));

  constructor(device: GPUDevice, store: GraphStore, settings: AppSettings) {
    this.device = device;
    this.store = store;
    const nodeOptions: GPUBufferDescriptor = {
      label: 'Graph nodes',
      size: MAX_NODES * NODE_STRIDE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    };
    this.nodeBuffers = [device.createBuffer(nodeOptions), device.createBuffer(nodeOptions)];
    this.edgeBuffer = device.createBuffer({
      label: 'Graph edges',
      size: MAX_EDGES * EDGE_STRIDE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.sceneUniformBuffer = device.createBuffer({
      label: 'Scene uniforms', size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.simUniformBuffer = device.createBuffer({
      label: 'Simulation uniforms', size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.rebuild(settings);
  }

  get nodeBuffer(): GPUBuffer {
    return this.nodeBuffers[this.current];
  }

  get nextNodeBuffer(): GPUBuffer {
    return this.nodeBuffers[this.current === 0 ? 1 : 0];
  }

  swap(): void {
    this.current = this.current === 0 ? 1 : 0;
  }

  rebuild(settings: AppSettings): void {
    this.nodeCount = Math.min(this.store.nodes.length, MAX_NODES);
    this.edgeCount = Math.min(this.store.edges.length, MAX_EDGES);
    const palette = PALETTES[settings.palette];
    this.nodeData.fill(0);
    for (let index = 0; index < this.nodeCount; index += 1) {
      const node = this.store.nodes[index]!;
      const offset = index * 16;
      const color = palette.clusters[node.cluster % palette.clusters.length]!;
      this.nodeData.set([node.position[0], node.position[1], settings.dimension === '2d' ? 0 : node.position[2], node.radius], offset);
      this.nodeData.set([0, 0, 0, 0], offset + 4);
      this.nodeData.set(color, offset + 8);
      this.nodeData.set([node.cluster, 0, 0, node.pinned ? 1 : 0], offset + 12);
    }
    this.device.queue.writeBuffer(this.nodeBuffers[0], 0, this.nodeData);
    this.device.queue.writeBuffer(this.nodeBuffers[1], 0, this.nodeData);
    this.writeEdges();
  }

  updatePalette(settings: AppSettings): void {
    const palette = PALETTES[settings.palette];
    for (let index = 0; index < this.nodeCount; index += 1) {
      const node = this.store.nodes[index]!;
      const color = new Float32Array(palette.clusters[node.cluster % palette.clusters.length]!);
      const metadataOffset = index * 16 + 12;
      const metadata = new Float32Array([
        node.cluster,
        this.nodeData[metadataOffset + 1]!,
        this.nodeData[metadataOffset + 2]!,
        this.nodeData[metadataOffset + 3]!,
      ]);
      this.nodeData.set(color, index * 16 + 8);
      this.nodeData.set(metadata, metadataOffset);
      for (const buffer of this.nodeBuffers) {
        this.device.queue.writeBuffer(buffer, index * NODE_STRIDE + 32, color);
        this.device.queue.writeBuffer(buffer, index * NODE_STRIDE + 48, metadata);
      }
    }
    this.writeEdges();
  }

  updateNodeMeta(index: number, selected: boolean, hovered: boolean, pinMode: -1 | 0 | 1): void {
    const node = this.store.nodes[index];
    if (!node) return;
    const meta = new Float32Array([node.cluster, selected ? 1 : 0, hovered ? 1 : 0, pinMode]);
    this.nodeData.set(meta, index * 16 + 12);
    for (const buffer of this.nodeBuffers) this.device.queue.writeBuffer(buffer, index * NODE_STRIDE + 48, meta);
  }

  updateNodePosition(index: number, position: Vec3, radius?: number): void {
    const node = this.store.nodes[index];
    if (!node) return;
    const packed = new Float32Array([position[0], position[1], position[2], radius ?? node.radius]);
    const zeroVelocity = new Float32Array(4);
    this.nodeData.set(packed, index * 16);
    this.nodeData.set(zeroVelocity, index * 16 + 4);
    for (const buffer of this.nodeBuffers) {
      this.device.queue.writeBuffer(buffer, index * NODE_STRIDE, packed);
      this.device.queue.writeBuffer(buffer, index * NODE_STRIDE + 16, zeroVelocity);
    }
  }

  writePositions(positions: Float32Array): void {
    for (let index = 0; index < this.nodeCount; index += 1) {
      const src = index * 3;
      const dst = index * 16;
      const node = this.store.nodes[index]!;
      this.nodeData.set([positions[src]!, positions[src + 1]!, positions[src + 2]!, node.radius], dst);
      this.nodeData.set([0, 0, 0, 0], dst + 4);
    }
    const activeData = this.nodeData.subarray(0, this.nodeCount * 16);
    for (const buffer of this.nodeBuffers) this.device.queue.writeBuffer(buffer, 0, activeData);
  }

  async readNodes(indices: number[]): Promise<Map<number, { position: Vec3; radius: number }>> {
    if (indices.length === 0) return new Map();
    const staging = this.device.createBuffer({
      label: 'Selected node readback',
      size: indices.length * NODE_STRIDE,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = this.device.createCommandEncoder({ label: 'Selected node query' });
    indices.forEach((index, outputIndex) => {
      encoder.copyBufferToBuffer(this.nodeBuffer, index * NODE_STRIDE, staging, outputIndex * NODE_STRIDE, NODE_STRIDE);
    });
    this.device.queue.submit([encoder.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const floats = new Float32Array(staging.getMappedRange());
    const result = new Map<number, { position: Vec3; radius: number }>();
    indices.forEach((index, outputIndex) => {
      const offset = outputIndex * 16;
      result.set(index, { position: [floats[offset]!, floats[offset + 1]!, floats[offset + 2]!], radius: floats[offset + 3]! });
    });
    staging.unmap();
    staging.destroy();
    return result;
  }

  async readPositions(): Promise<Float32Array> {
    if (this.nodeCount === 0) return new Float32Array(0);
    const byteLength = this.nodeCount * NODE_STRIDE;
    const staging = this.device.createBuffer({
      label: 'Graph position readback',
      size: byteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    try {
      const encoder = this.device.createCommandEncoder({ label: 'Graph position query' });
      encoder.copyBufferToBuffer(this.nodeBuffer, 0, staging, 0, byteLength);
      this.device.queue.submit([encoder.finish()]);
      await staging.mapAsync(GPUMapMode.READ);
      const records = new Float32Array(staging.getMappedRange());
      const positions = new Float32Array(this.nodeCount * 4);
      for (let index = 0; index < this.nodeCount; index += 1) {
        const source = index * (NODE_STRIDE / 4);
        positions.set(records.subarray(source, source + 4), index * 4);
      }
      staging.unmap();
      return positions;
    } finally {
      staging.destroy();
    }
  }

  dispose(): void {
    this.nodeBuffers[0].destroy();
    this.nodeBuffers[1].destroy();
    this.edgeBuffer.destroy();
    this.sceneUniformBuffer.destroy();
    this.simUniformBuffer.destroy();
  }

  private writeEdges(): void {
    const data = new ArrayBuffer(MAX_EDGES * EDGE_STRIDE);
    const view = new DataView(data);
    for (let index = 0; index < this.edgeCount; index += 1) {
      const edge = this.store.edges[index]!;
      const base = index * EDGE_STRIDE;
      const sourceIndex = Math.max(0, this.store.indexOf(edge.source));
      const targetIndex = Math.max(0, this.store.indexOf(edge.target));
      const flags = edgeRegionFlags(this.store.nodes[sourceIndex]?.cluster ?? 0, this.store.nodes[targetIndex]?.cluster ?? 0);
      const crossesRegion = (flags & EDGE_FLAG_CROSS_REGION) !== 0;
      view.setUint32(base, sourceIndex, true);
      view.setUint32(base + 4, targetIndex, true);
      view.setUint32(base + 8, flags, true);
      view.setUint32(base + 12, 0, true);
      view.setFloat32(base + 16, crossesRegion ? 1.65 : 0.62, true);
      view.setFloat32(base + 20, crossesRegion ? 0.80 + edge.strength * 0.18 : 0.46 + edge.strength * 0.34, true);
      view.setFloat32(base + 24, 0, true);
      view.setFloat32(base + 28, (index % 11) * 0.17, true);
    }
    this.device.queue.writeBuffer(this.edgeBuffer, 0, data);
  }
}
