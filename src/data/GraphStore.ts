import { MAX_EDGES, MAX_NODES, type GraphData, type GraphEdge, type GraphNode, type Vec3 } from '../core/types';
import { createStarterGraph } from './starterGraph';
import type { PersistenceStore } from './persistence';

const POSITION_DEBOUNCE_MS = 750;

export class GraphStore extends EventTarget {
  readonly nodes: GraphNode[];
  readonly edges: GraphEdge[];
  sceneId: string;
  private idToIndex = new Map<string, number>();
  private sourceGraph: GraphData;
  private persist: PersistenceStore | null = null;
  private positionTimer: ReturnType<typeof setTimeout> | undefined;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(sceneId = 'tutorial', sourceGraph: GraphData = createStarterGraph()) {
    super();
    this.sceneId = sceneId;
    this.sourceGraph = structuredClone(sourceGraph);
    this.nodes = structuredClone(this.sourceGraph.nodes);
    this.edges = structuredClone(this.sourceGraph.edges);
    this.reindex();
  }

  async attachPersistence(store: PersistenceStore): Promise<void> {
    this.persist = store;
    const graph = await this.load(this.sceneId, this.sourceGraph);
    this.nodes.splice(0, this.nodes.length, ...graph.nodes);
    this.edges.splice(0, this.edges.length, ...graph.edges);
    this.reindex();
  }

  indexOf(id: string): number {
    return this.idToIndex.get(id) ?? -1;
  }

  get(id: string): GraphNode | undefined {
    const index = this.indexOf(id);
    return index >= 0 ? this.nodes[index] : undefined;
  }

  addNode(title: string, position: Vec3, cluster = 0, subcluster?: string): GraphNode | undefined {
    if (this.nodes.length >= MAX_NODES) return undefined;
    const id = `node-${crypto.randomUUID()}`;
    const node: GraphNode = {
      id,
      title: title.trim() || 'Untitled thought',
      description: 'A fresh thought. Give it context, then connect it to the map.',
      cluster: Math.max(0, Math.min(4, cluster)),
      subcluster,
      position,
      radius: 0.58,
      tags: ['New'],
    };
    this.nodes.push(node);
    this.reindex();
    this.commit('topology', node.id);
    return node;
  }

  updateNode(id: string, patch: Partial<Pick<GraphNode, 'title' | 'description' | 'cluster' | 'tags' | 'pinned'>>): void {
    const node = this.get(id);
    if (!node) return;
    Object.assign(node, patch);
    this.commit('content', id);
  }

  deleteNode(id: string): void {
    const index = this.indexOf(id);
    if (index < 0) return;
    this.nodes.splice(index, 1);
    for (let edge = this.edges.length - 1; edge >= 0; edge -= 1) {
      if (this.edges[edge]!.source === id || this.edges[edge]!.target === id) this.edges.splice(edge, 1);
    }
    this.reindex();
    this.commit('topology', id);
  }

  link(source: string, target: string): GraphEdge | undefined {
    if (source === target || !this.get(source) || !this.get(target) || this.edges.length >= MAX_EDGES) return undefined;
    const existing = this.edges.find((edge) =>
      (edge.source === source && edge.target === target) || (edge.source === target && edge.target === source));
    if (existing) return existing;
    const edge: GraphEdge = { id: `edge-${crypto.randomUUID()}`, source, target, strength: 0.65 };
    this.edges.push(edge);
    this.commit('topology', edge.id);
    return edge;
  }

  async switchScene(sceneId: string, sourceGraph: GraphData): Promise<void> {
    if (sceneId === this.sceneId) return;
    await this.flushPositions();
    this.sceneId = sceneId;
    this.sourceGraph = structuredClone(sourceGraph);
    const graph = await this.load(sceneId, this.sourceGraph);
    this.nodes.splice(0, this.nodes.length, ...graph.nodes);
    this.edges.splice(0, this.edges.length, ...graph.edges);
    this.reindex();
    this.dispatchEvent(new CustomEvent('change', { detail: { kind: 'topology', id: 'scene', sceneChanged: true } }));
  }

  reset(): void {
    const graph = structuredClone(this.sourceGraph);
    this.nodes.splice(0, this.nodes.length, ...graph.nodes);
    this.edges.splice(0, this.edges.length, ...graph.edges);
    this.reindex();
    this.commit('topology', 'reset');
  }

  setNodePosition(index: number, position: Vec3): void {
    const node = this.nodes[index];
    if (!node) return;
    node.position = [...position];
    this.schedulePositionPersist();
  }

  persistPositions(positions: Float32Array, stride = 4): void {
    const safeStride = Math.max(3, Math.floor(stride));
    const count = Math.min(this.nodes.length, Math.floor(positions.length / safeStride));
    for (let index = 0; index < count; index += 1) {
      const offset = index * safeStride;
      this.nodes[index]!.position = [positions[offset]!, positions[offset + 1]!, positions[offset + 2]!];
    }
    this.schedulePositionPersist();
  }

  async flushPositions(): Promise<void> {
    if (this.positionTimer !== undefined) globalThis.clearTimeout(this.positionTimer);
    this.positionTimer = undefined;
    await this.queuePersist();
  }

  private reindex(): void {
    this.idToIndex = new Map(this.nodes.map((node, index) => [node.id, index]));
  }

  private schedulePositionPersist(): void {
    if (this.positionTimer !== undefined) globalThis.clearTimeout(this.positionTimer);
    this.positionTimer = globalThis.setTimeout(() => {
      this.positionTimer = undefined;
      void this.queuePersist();
    }, POSITION_DEBOUNCE_MS);
  }

  private commit(kind: 'topology' | 'content', id: string): void {
    void this.queuePersist();
    this.dispatchEvent(new CustomEvent('change', { detail: { kind, id } }));
  }

  private queuePersist(): Promise<void> {
    this.persistQueue = this.persistQueue
      .then(() => this.persistCurrentScene())
      .catch((error) => console.error('Failed to persist graph', error));
    return this.persistQueue;
  }

  private async persistCurrentScene(): Promise<void> {
    if (!this.persist) return;
    await this.persist.saveScene(this.sceneId, { nodes: this.nodes, edges: this.edges });
  }

  private async load(sceneId: string, sourceGraph: GraphData): Promise<GraphData> {
    if (this.persist) {
      try {
        const stored = await this.persist.loadScene(sceneId);
        if (stored) return hydrateFromStored(stored, sourceGraph);
      } catch (error) {
        console.warn('Failed to load persisted scene; using starter map.', error);
      }
    }
    return structuredClone(sourceGraph);
  }
}

function hydrateFromStored(stored: GraphData, sourceGraph: GraphData): GraphData {
  const sourceById = new Map(sourceGraph.nodes.map((node) => [node.id, node]));
  const nodes = stored.nodes.slice(0, MAX_NODES).map((node) => {
    const source = sourceById.get(node.id);
    if (!source) return node;
    if (/Open this thought, rewrite it/.test(node.description)) {
      return { ...node, description: source.description };
    }
    return node;
  });
  return { nodes, edges: stored.edges.slice(0, MAX_EDGES) };
}
