import type { GraphScene, SceneSubcluster } from '../../core/types';
import { createStarterGraph } from '../starterGraph';

const GROUPS: Array<[string, string, string, string]> = [
  ['Systems', 'Foundations', 'Dynamics', 'Enter the hidden machinery of things, where a small rule can wake an entire world.'],
  ['Making', 'Studio', 'Composition', 'A lantern-lit studio for shaping rough sparks into artifacts with a life of their own.'],
  ['Mind', 'Inner life', 'Meaning', 'Follow attention inward, through the weather of perception, memory, learning, and meaning.'],
  ['Technology', 'Compute', 'Interfaces', 'Explore strange new instruments: agents, living protocols, and tools that extend thought.'],
  ['Living world', 'Ecology', 'Regeneration', 'Walk among signals, roots, energy, and the quiet intelligence of resilient life.'],
];

const subclusters: SceneSubcluster[] = GROUPS.flatMap(([region, first, second, description], cluster) => [
  { id: `tutorial-${cluster}-core`, label: `${region} · ${first}`, cluster, description },
  { id: `tutorial-${cluster}-field`, label: `${region} · ${second}`, cluster, description },
]);

export const tutorialScene: GraphScene = {
  id: 'tutorial',
  title: 'The First Constellation',
  shortTitle: 'First Constellation',
  kicker: 'YOUR JOURNEY BEGINS',
  description: 'Choose any bright point. Every trail is an invitation into systems, craft, mind, technology, and the living world.',
  palette: 'cobalt',
  layout: 'clusters',
  graph: createStarterGraph(),
  clusterLabels: GROUPS.map(([region]) => region),
  subclusters,
};
