import { afterEach, describe, expect, it } from 'vitest';
import { Box3DBackend } from './Box3DBackend';

describe('Box3DBackend', () => {
  let backend: Box3DBackend | undefined;

  afterEach(() => backend?.dispose());

  it('steps native sphere bodies connected by a fun-mode distance joint', async () => {
    backend = new Box3DBackend({ dimension: '3d' });
    await backend.setGraph({
      nodes: [
        { id: 'a', position: { x: -1, y: 0, z: 0 }, radius: 0.5, cluster: 0 },
        { id: 'b', position: { x: 1, y: 0, z: 0 }, radius: 0.5, cluster: 0 },
      ],
      edges: [{ source: 'a', target: 'b', restLength: 2, strength: 1 }],
    });
    backend.setFunPreset('zero-g');
    backend.burst(0.2);
    const positions = backend.step(1 / 60);
    expect(backend.initialized).toBe(true);
    expect(positions).toHaveLength(6);
    expect([...positions].every(Number.isFinite)).toBe(true);
  });
});
