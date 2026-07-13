import type { GraphData, GraphEdge, GraphNode, GraphScene, LayoutId, PaletteId, ScenePortal, SceneSubcluster, Vec3 } from '../core/types';

export interface ConceptSeed {
  title: string;
  description: string;
  tags?: string[];
  portal?: ScenePortal;
}

export interface SubclusterSeed {
  id: string;
  label: string;
  description: string;
  concepts: ConceptSeed[];
}

export interface ClusterSeed {
  name: string;
  subclusters: [SubclusterSeed, SubclusterSeed];
}

export interface SceneSeed {
  id: string;
  title: string;
  shortTitle: string;
  kicker: string;
  description: string;
  palette: PaletteId;
  layout: LayoutId;
  shape: 'radial' | 'tree' | 'path';
  clusters: [ClusterSeed, ClusterSeed, ClusterSeed, ClusterSeed, ClusterSeed];
  crossLinks?: Array<[string, string]>;
  sources?: string[];
}

const TREE_CENTERS: Vec3[] = [[0, 9, 0], [-7, 3.5, -1.5], [7, 3.5, 1.5], [-5, -5, 2], [5, -5, -2]];
const PATH_CENTERS: Vec3[] = [[-11, 5, -2], [-6, 2.5, 1], [0, 0, -1], [6, -2.5, 2], [11, -5, 0]];

function slug(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function seeded(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function clusterCenter(shape: SceneSeed['shape'], cluster: number): Vec3 {
  if (shape === 'tree') return [...TREE_CENTERS[cluster]!] as Vec3;
  if (shape === 'path') return [...PATH_CENTERS[cluster]!] as Vec3;
  const angle = cluster / 5 * Math.PI * 2 - Math.PI * 0.5;
  return [Math.cos(angle) * 8.4, Math.sin(angle) * 8.4, Math.sin(angle * 2) * 2.2];
}

function conceptPosition(seed: SceneSeed, cluster: number, subcluster: number, concept: number, id: string): Vec3 {
  const center = clusterCenter(seed.shape, cluster);
  const subAngle = (subcluster === 0 ? -1 : 1) * (0.48 + cluster * 0.14);
  const localAngle = concept * 2.399963 + subAngle;
  const radius = 0.9 + Math.sqrt(concept + 0.4) * 1.12;
  return [
    center[0] + Math.cos(localAngle) * radius + (subcluster === 0 ? -0.9 : 0.9),
    center[1] + Math.sin(localAngle) * radius,
    center[2] + (seeded(id) - 0.5) * 5.2,
  ];
}

export function buildScene(seed: SceneSeed): GraphScene {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const subclusters: SceneSubcluster[] = [];
  const idByTitle = new Map<string, string>();
  const clusterAnchors: string[] = [];

  seed.clusters.forEach((cluster, clusterIndex) => {
    const subclusterAnchors: string[] = [];
    cluster.subclusters.forEach((group, groupIndex) => {
      subclusters.push({ id: group.id, label: group.label, cluster: clusterIndex, description: group.description });
      group.concepts.forEach((concept, conceptIndex) => {
        const id = `${seed.id}-${group.id}-${slug(concept.title)}`;
        idByTitle.set(concept.title, id);
        nodes.push({
          id,
          title: concept.title,
          description: concept.description,
          cluster: clusterIndex,
          subcluster: group.id,
          position: conceptPosition(seed, clusterIndex, groupIndex, conceptIndex, id),
          radius: conceptIndex === 0 ? 0.82 : 0.46 + seeded(`${id}:radius`) * 0.16,
          tags: [cluster.name, group.label, ...(concept.tags ?? [])],
          portal: concept.portal,
        });
        if (conceptIndex === 0) subclusterAnchors.push(id);
        else {
          edges.push({ id: `${id}-anchor`, source: subclusterAnchors[0]!, target: id, strength: 0.82 });
          if (conceptIndex > 1) {
            const previous = nodes[nodes.length - 2]!;
            edges.push({ id: `${id}-chain`, source: previous.id, target: id, strength: 0.42 });
          }
        }
      });
    });
    edges.push({ id: `${seed.id}-cluster-${clusterIndex}`, source: subclusterAnchors[0]!, target: subclusterAnchors[1]!, strength: 0.7 });
    clusterAnchors.push(subclusterAnchors[0]!);
  });

  for (let index = 0; index < clusterAnchors.length; index += 1) {
    const next = seed.shape === 'tree' && index === clusterAnchors.length - 1 ? 0 : (index + 1) % clusterAnchors.length;
    edges.push({
      id: `${seed.id}-region-${index}`,
      source: clusterAnchors[index]!,
      target: clusterAnchors[next]!,
      strength: seed.shape === 'tree' ? 0.32 : 0.46,
    });
  }
  for (const [sourceTitle, targetTitle] of seed.crossLinks ?? []) {
    const source = idByTitle.get(sourceTitle);
    const target = idByTitle.get(targetTitle);
    if (source && target) edges.push({ id: `${seed.id}-cross-${edges.length}`, source, target, strength: 0.36 });
  }

  return {
    id: seed.id,
    title: seed.title,
    shortTitle: seed.shortTitle,
    kicker: seed.kicker,
    description: seed.description,
    palette: seed.palette,
    layout: seed.layout,
    graph: { nodes, edges },
    clusterLabels: seed.clusters.map((cluster) => cluster.name),
    subclusters,
    sources: seed.sources,
  };
}
