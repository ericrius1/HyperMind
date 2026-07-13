import type { GraphScene, SceneSubcluster } from '../../core/types';
import { createStarterGraph } from '../starterGraph';

const GROUPS: Array<[string, string, string, string]> = [
  ['Systems', 'Foundations', 'Dynamics', 'Core systems patterns and the behaviors they produce.'],
  ['Making', 'Studio', 'Composition', 'Ways of shaping artifacts through craft and iteration.'],
  ['Mind', 'Inner life', 'Meaning', 'Attention, learning, perception, and the models behind experience.'],
  ['Technology', 'Compute', 'Interfaces', 'GPU-native tools, agents, protocols, and tools for thought.'],
  ['Living world', 'Ecology', 'Regeneration', 'Life, energy, signals, and resilient living systems.'],
];

const subclusters: SceneSubcluster[] = GROUPS.flatMap(([region, first, second, description], cluster) => [
  { id: `tutorial-${cluster}-core`, label: `${region} · ${first}`, cluster, description },
  { id: `tutorial-${cluster}-field`, label: `${region} · ${second}`, cluster, description },
]);

export const tutorialScene: GraphScene = {
  id: 'tutorial',
  title: 'HyperMind Tutorial Atlas',
  shortTitle: 'Tutorial Atlas',
  kicker: 'START HERE',
  description: 'A guided field of systems, making, mind, technology, and the living world.',
  palette: 'cobalt',
  layout: 'clusters',
  graph: createStarterGraph(),
  clusterLabels: GROUPS.map(([region]) => region),
  subclusters,
};
