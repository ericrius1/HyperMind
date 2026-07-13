import { MAX_EDGES, MAX_NODES, type GraphData, type GraphEdge, type GraphNode, type Vec3 } from '../core/types';
import { createStarterGraph } from './starterGraph';

const STORAGE_KEY = 'hypermind.graph.v2';

export class GraphStore extends EventTarget {
  readonly nodes: GraphNode[];
  readonly edges: GraphEdge[];
  sceneId: string;
  private idToIndex = new Map<string, number>();
  private sourceGraph: GraphData;

  constructor(sceneId = 'tutorial', sourceGraph: GraphData = createStarterGraph()) {
    super();
    this.sceneId = sceneId;
    this.sourceGraph = structuredClone(sourceGraph);
    const graph = this.load(sceneId, this.sourceGraph);
    this.nodes = graph.nodes;
    this.edges = graph.edges;
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

  switchScene(sceneId: string, sourceGraph: GraphData): void {
    if (sceneId === this.sceneId) return;
    this.sceneId = sceneId;
    this.sourceGraph = structuredClone(sourceGraph);
    const graph = this.load(sceneId, this.sourceGraph);
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

  persistPositions(positions: Float32Array): void {
    for (let index = 0; index < this.nodes.length; index += 1) {
      const offset = index * 4;
      this.nodes[index]!.position = [positions[offset]!, positions[offset + 1]!, positions[offset + 2]!];
    }
    this.persist();
  }

  private reindex(): void {
    this.idToIndex = new Map(this.nodes.map((node, index) => [node.id, index]));
  }

  private commit(kind: 'topology' | 'content', id: string): void {
    this.persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { kind, id } }));
  }

  private persist(): void {
    localStorage.setItem(`${STORAGE_KEY}.${this.sceneId}`, JSON.stringify({ nodes: this.nodes, edges: this.edges }));
  }

  private load(sceneId: string, sourceGraph: GraphData): GraphData {
    try {
      const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY}.${sceneId}`) ?? '') as GraphData;
      if (Array.isArray(stored.nodes) && Array.isArray(stored.edges)) {
        return { nodes: stored.nodes.slice(0, MAX_NODES), edges: stored.edges.slice(0, MAX_EDGES) };
      }
    } catch {
      // Corrupt or incompatible graph data resets to the current starter map.
    }
    return structuredClone(sourceGraph);
  }
}
