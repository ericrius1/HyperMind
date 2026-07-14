import { describe, expect, it, vi } from 'vitest';
import type { GraphData } from '../core/types';
import { MemoryPersistenceStore } from './persistence/memoryStore';
import { GraphStore } from './GraphStore';

const graph: GraphData = {
  nodes: [
    { id: 'a', title: 'A', description: '', cluster: 0, position: [0, 0, 0], radius: 1, tags: [] },
    { id: 'b', title: 'B', description: '', cluster: 1, position: [1, 1, 1], radius: 1, tags: [] },
  ],
  edges: [],
};

describe('GraphStore position persistence', () => {
  it('accepts compact Box3D positions and GPU records', () => {
    vi.useFakeTimers();
    const store = new GraphStore('test', graph);
    store.persistPositions(new Float32Array([2, 3, 4, 5, 6, 7]), 3);
    expect(store.nodes.map((node) => node.position)).toEqual([[2, 3, 4], [5, 6, 7]]);

    store.persistPositions(new Float32Array([8, 9, 10, 0.5, 11, 12, 13, 0.6]));
    expect(store.nodes.map((node) => node.position)).toEqual([[8, 9, 10], [11, 12, 13]]);
    vi.useRealTimers();
  });

  it('keeps dragged positions as CPU source of truth and flushes them', async () => {
    vi.useFakeTimers();
    const persistence = new MemoryPersistenceStore();
    await persistence.open();
    const store = new GraphStore('test', graph);
    await store.attachPersistence(persistence);

    store.setNodePosition(1, [20, 21, 22]);
    await store.flushPositions();
    expect((await persistence.loadScene('test'))?.nodes[1]?.position).toEqual([20, 21, 22]);
    vi.useRealTimers();
  });
});
