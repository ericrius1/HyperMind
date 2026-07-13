import { describe, expect, it } from 'vitest';
import { MAX_EDGES, MAX_NODES } from '../core/types';
import { createStarterGraph } from './starterGraph';

describe('starter graph', () => {
  it('has stable, valid topology inside the interactive GPU tier', () => {
    const graph = createStarterGraph();
    const ids = new Set(graph.nodes.map((node) => node.id));
    expect(ids.size).toBe(graph.nodes.length);
    expect(graph.nodes.length).toBeLessThanOrEqual(MAX_NODES);
    expect(graph.edges.length).toBeLessThanOrEqual(MAX_EDGES);
    expect(graph.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
  });

  it('covers all five visual regions', () => {
    const graph = createStarterGraph();
    expect(new Set(graph.nodes.map((node) => node.cluster))).toEqual(new Set([0, 1, 2, 3, 4]));
  });
});
