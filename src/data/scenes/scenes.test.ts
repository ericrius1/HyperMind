import { describe, expect, it } from 'vitest';
import { MAX_EDGES, MAX_NODES } from '../../core/types';
import { parseFocus } from '../sceneRoute';
import { DEFAULT_SCENE_ID, getScene, SCENES, SCENES_BY_ID } from './index';

describe('sample scene catalog', () => {
  it('contains the default agent-learning world plus four fully nested atlases', () => {
    expect(DEFAULT_SCENE_ID).toBe('agent-learning');
    expect(getScene('missing').id).toBe(DEFAULT_SCENE_ID);
    expect(SCENES.map((scene) => scene.id)).toEqual(['agent-learning', 'tutorial', 'kabbalah', 'francis', 'pilgrim']);
    const agentScene = SCENES_BY_ID.get(DEFAULT_SCENE_ID)!;
    expect(agentScene.graph.nodes).toHaveLength(50);
    expect(agentScene.clusterLabels).toEqual([
      'RL Foundations',
      'Learning Algorithms',
      'Multi-Agent Learning',
      'Evolutionary Computation',
      'Persistent San Francisco Lab',
    ]);
    for (const scene of SCENES) {
      expect(scene.clusterLabels).toHaveLength(5);
      expect(scene.subclusters).toHaveLength(10);
      expect(scene.graph.nodes.length).toBeLessThanOrEqual(MAX_NODES);
      expect(scene.graph.edges.length).toBeLessThanOrEqual(MAX_EDGES);
      const ids = new Set(scene.graph.nodes.map((node) => node.id));
      expect(ids.size).toBe(scene.graph.nodes.length);
      expect(scene.graph.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
      for (const group of scene.subclusters) {
        expect(scene.graph.nodes.filter((node) => node.subcluster === group.id).length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('keeps every cross-scene portal resolvable', () => {
    for (const scene of SCENES) {
      for (const node of scene.graph.nodes) {
        if (!node.portal) continue;
        const targetScene = SCENES_BY_ID.get(node.portal.scene);
        expect(targetScene, `${scene.id}/${node.id} target scene`).toBeDefined();
        const focus = parseFocus(node.portal.focus ?? null);
        if (focus.type === 'subcluster') {
          expect(targetScene!.subclusters.some((group) => group.id === focus.id), `${node.title} target group`).toBe(true);
        } else if (focus.type === 'node') {
          expect(targetScene!.graph.nodes.some((target) => target.id === focus.id), `${node.title} target node`).toBe(true);
        }
      }
    }
  });
});
