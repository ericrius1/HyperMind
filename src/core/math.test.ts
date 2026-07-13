import { describe, expect, it } from 'vitest';
import { mat4Identity, mat4Multiply, mat4Ortho, transformPoint, vec3Cross, vec3Normalize } from './math';

describe('math primitives', () => {
  it('preserves matrices multiplied by identity', () => {
    const matrix = mat4Ortho(-2, 2, -1, 1, -10, 10);
    const multiplied = mat4Multiply(matrix, mat4Identity());
    for (let index = 0; index < 16; index += 1) expect(multiplied[index]).toBeCloseTo(matrix[index]!);
  });

  it('projects the origin through an orthographic matrix', () => {
    const projected = transformPoint(mat4Ortho(-2, 2, -2, 2, -10, 10), [0, 0, 0]);
    expect(projected[0]).toBeCloseTo(0);
    expect(projected[1]).toBeCloseTo(0);
    expect(projected[3]).toBeCloseTo(1);
  });

  it('builds an orthonormal cross-product axis', () => {
    const axis = vec3Normalize(vec3Cross([0, 0, -1], [0, 1, 0]));
    expect(axis[0]).toBeCloseTo(1);
    expect(axis[1]).toBeCloseTo(0);
    expect(axis[2]).toBeCloseTo(0);
  });
});
