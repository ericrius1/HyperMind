import type { GraphData, GraphEdge, GraphNode, Vec3 } from '../core/types';

const CLUSTERS = [
  {
    name: 'Systems',
    concepts: [
      ['Emergence', 'Order rising unbidden from many quiet rules.'],
      ['Feedback loops', 'What you change returns to change you.'],
      ['Constraints', 'The narrow door that gives the room its shape.'],
      ['Leverage points', 'Small touches where the whole machinery listens.'],
      ['Networks', 'Meaning traveling along invisible threads.'],
      ['Adaptation', 'Learning the weather without losing your name.'],
      ['Resilience', 'The art of bending without becoming gone.'],
      ['Second-order effects', 'Ripples that arrive after the stone is forgotten.'],
      ['Boundaries', 'Where one world ends so another can begin.'],
      ['Flow', 'The quiet current that keeps a system alive.'],
    ],
  },
  {
    name: 'Making',
    concepts: [
      ['Craft', 'Care made visible through patient hands.'],
      ['Prototypes', 'Rough drafts brave enough to meet the air.'],
      ['Materials', 'Matter whispering what it wants to become.'],
      ['Iteration', 'Returning again until the thing finds itself.'],
      ['Tools', 'Extensions of intention, waiting to be held.'],
      ['Taste', 'The compass you hone by loving and refusing.'],
      ['Composition', 'Parts arranged until they begin to sing.'],
      ['Structure', 'The invisible bones that hold wonder upright.'],
      ['Rhythm', 'Time given a pulse you can build inside.'],
      ['Details', 'The small fidelities that make a work feel true.'],
    ],
  },
  {
    name: 'Mind',
    concepts: [
      ['Attention', 'The lamp you aim, and so the world you get.'],
      ['Memory', 'What remains glowing after the moment leaves.'],
      ['Curiosity', 'The hunger that opens every locked room.'],
      ['Intuition', 'Knowing that arrives before the argument.'],
      ['Learning', 'Becoming slightly more than you were yesterday.'],
      ['Perception', 'The filter through which reality arrives dressed.'],
      ['Dreams', 'Night’s workshop, rearranging the day’s debris.'],
      ['Language', 'A bridge of breath between one mind and another.'],
      ['Models', 'Maps we carry that are never quite the land.'],
      ['Meaning', 'The gold you mint from what happens to you.'],
    ],
  },
  {
    name: 'Technology',
    concepts: [
      ['WebGPU', 'Raw metal of the browser, bent toward light.'],
      ['Spatial compute', 'Thoughts that live in rooms, not only rows.'],
      ['Interfaces', 'The handshake between intention and machine.'],
      ['Agents', 'Helpers that wander on your behalf.'],
      ['Simulation', 'A world rehearsed until truth shows its face.'],
      ['Shaders', 'Tiny spells that paint reality each frame.'],
      ['Data', 'Frozen echoes waiting to be asked the right question.'],
      ['Protocols', 'Agreements that let strangers speak as kin.'],
      ['Local first', 'Your tools loyal to your machine before the cloud.'],
      ['Tools for thought', 'Instruments that widen what a mind can hold.'],
    ],
  },
  {
    name: 'Living world',
    concepts: [
      ['Mycelium', 'A hidden web trading news beneath the forest floor.'],
      ['Ecology', 'Lives braided so tightly they breathe as one.'],
      ['Light', 'The oldest messenger, writing color on every leaf.'],
      ['Water', 'The pilgrim element, always becoming elsewhere.'],
      ['Climate', 'The long weather that writes our shared fate.'],
      ['Energy', 'The restless gift that makes matter dance.'],
      ['Growth', 'Patience wearing the shape of living form.'],
      ['Signals', 'Whispers between bodies that never need words.'],
      ['Biodiversity', 'A chorus richer for every different voice.'],
      ['Regeneration', 'Healing that remakes the wound into a door.'],
    ],
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
    cluster.concepts.forEach(([title, description], localIndex) => {
      const id = `n-${clusterIndex}-${localIndex}`;
      nodes.push({
        id,
        title,
        description,
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
