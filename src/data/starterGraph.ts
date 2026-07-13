import type { GraphData, GraphEdge, GraphNode, Vec3 } from '../core/types';

const CLUSTERS = [
  {
    name: 'Systems',
    concepts: ['Emergence', 'Feedback loops', 'Constraints', 'Leverage points', 'Networks', 'Adaptation', 'Resilience', 'Second-order effects', 'Boundaries', 'Flow'],
  },
  {
    name: 'Making',
    concepts: ['Craft', 'Prototypes', 'Materials', 'Iteration', 'Tools', 'Taste', 'Composition', 'Structure', 'Rhythm', 'Details'],
  },
  {
    name: 'Mind',
    concepts: ['Attention', 'Memory', 'Curiosity', 'Intuition', 'Learning', 'Perception', 'Dreams', 'Language', 'Models', 'Meaning'],
  },
  {
    name: 'Technology',
    concepts: ['WebGPU', 'Spatial compute', 'Interfaces', 'Agents', 'Simulation', 'Shaders', 'Data', 'Protocols', 'Local first', 'Tools for thought'],
  },
  {
    name: 'Living world',
    concepts: ['Mycelium', 'Ecology', 'Light', 'Water', 'Climate', 'Energy', 'Growth', 'Signals', 'Biodiversity', 'Regeneration'],
  },
] as const;

function seeded(index: number): number {
  const value = Math.sin(index * 9283.17 + 17.31) * 43758.5453;
  return value - Math.floor(value);
}

function positionFor(cluster: number, local: number): Vec3 {
  const clusterAngle = (cluster / CLUSTERS.length) * Math.PI * 2 - Math.PI * 0.5;
  const centerRadius = 8.2;
  const localAngle = local * 2.39996 + cluster * 0.71;
  const localRadius = 0.9 + Math.sqrt(local + 0.4) * 1.15;
  return [
    Math.cos(clusterAngle) * centerRadius + Math.cos(localAngle) * localRadius,
    Math.sin(clusterAngle) * centerRadius + Math.sin(localAngle) * localRadius,
    (seeded(cluster * 31 + local) - 0.5) * 8,
  ];
}

export function createStarterGraph(): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  CLUSTERS.forEach((cluster, clusterIndex) => {
    cluster.concepts.forEach((title, localIndex) => {
      const id = `n-${clusterIndex}-${localIndex}`;
      nodes.push({
        id,
        title,
        description: `${title} is part of the ${cluster.name.toLowerCase()} region. Open this thought, rewrite it, or connect it to something unexpected.`,
        cluster: clusterIndex,
        subcluster: `tutorial-${clusterIndex}-${localIndex < 5 ? 'core' : 'field'}`,
        position: positionFor(clusterIndex, localIndex),
        radius: localIndex === 0 ? 0.78 : 0.46 + seeded(clusterIndex * 19 + localIndex) * 0.17,
        tags: [cluster.name, localIndex === 0 ? 'Anchor' : 'Concept'],
      });

      if (localIndex > 0) {
        edges.push({ id: `e-${clusterIndex}-${localIndex}-root`, source: `n-${clusterIndex}-0`, target: id, strength: 0.8 });
      }
      if (localIndex > 1) {
        edges.push({ id: `e-${clusterIndex}-${localIndex}-chain`, source: `n-${clusterIndex}-${localIndex - 1}`, target: id, strength: 0.5 });
      }
    });
  });

  const crossLinks: Array<[string, string]> = [
    ['n-0-0', 'n-2-8'], ['n-0-4', 'n-3-7'], ['n-0-6', 'n-4-1'], ['n-1-1', 'n-3-4'],
    ['n-1-5', 'n-2-3'], ['n-1-8', 'n-4-6'], ['n-2-0', 'n-3-9'], ['n-2-4', 'n-4-7'],
    ['n-3-0', 'n-1-3'], ['n-3-1', 'n-2-5'], ['n-3-5', 'n-4-2'], ['n-4-0', 'n-0-5'],
  ];
  crossLinks.forEach(([source, target], index) => edges.push({ id: `cross-${index}`, source, target, strength: 0.34 }));
  return { nodes, edges };
}
