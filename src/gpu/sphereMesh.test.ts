import { describe, expect, it } from 'vitest';
import {
  createUVSphere,
  SPHERE_RINGS,
  SPHERE_SEGMENTS,
  SPHERE_VERTEX_COUNT,
} from './sphereMesh';

describe('createUVSphere', () => {
  it('returns a triangle-list of unit positions', () => {
    const mesh = createUVSphere();
    expect(mesh.length % 9).toBe(0);
    expect(mesh.length / 3).toBe(SPHERE_VERTEX_COUNT);

    for (let index = 0; index < mesh.length; index += 3) {
      const length = Math.hypot(mesh[index]!, mesh[index + 1]!, mesh[index + 2]!);
      expect(length).toBeGreaterThan(0.98);
      expect(length).toBeLessThan(1.02);
    }
  });

  it('uses a smooth default mesh without an extreme vertex count', () => {
    const expectedTriangles = SPHERE_SEGMENTS * (SPHERE_RINGS * 2 - 2);
    expect(SPHERE_VERTEX_COUNT).toBe(expectedTriangles * 3);
    expect(SPHERE_VERTEX_COUNT).toBeGreaterThanOrEqual(3_000);
    expect(SPHERE_VERTEX_COUNT).toBeLessThan(4_000);
  });

  it('omits zero-area pole triangles at custom tessellation levels', () => {
    const segments = 16;
    const rings = 12;
    const mesh = createUVSphere(segments, rings);
    expect(mesh.length / 9).toBe(segments * (rings * 2 - 2));

    for (let offset = 0; offset < mesh.length; offset += 9) {
      const ab = [
        mesh[offset + 3]! - mesh[offset]!,
        mesh[offset + 4]! - mesh[offset + 1]!,
        mesh[offset + 5]! - mesh[offset + 2]!,
      ];
      const ac = [
        mesh[offset + 6]! - mesh[offset]!,
        mesh[offset + 7]! - mesh[offset + 1]!,
        mesh[offset + 8]! - mesh[offset + 2]!,
      ];
      const cross = [
        ab[1]! * ac[2]! - ab[2]! * ac[1]!,
        ab[2]! * ac[0]! - ab[0]! * ac[2]!,
        ab[0]! * ac[1]! - ab[1]! * ac[0]!,
      ];
      expect(Math.hypot(...cross)).toBeGreaterThan(1e-5);
      const centroid = [
        (mesh[offset]! + mesh[offset + 3]! + mesh[offset + 6]!) / 3,
        (mesh[offset + 1]! + mesh[offset + 4]! + mesh[offset + 7]!) / 3,
        (mesh[offset + 2]! + mesh[offset + 5]! + mesh[offset + 8]!) / 3,
      ];
      expect(cross[0]! * centroid[0]! + cross[1]! * centroid[1]! + cross[2]! * centroid[2]!).toBeGreaterThan(0);
    }
  });

  it('rejects tessellation values that cannot form a sphere', () => {
    expect(() => createUVSphere(2, 12)).toThrow(RangeError);
    expect(() => createUVSphere(16, 1)).toThrow(RangeError);
    expect(() => createUVSphere(12.5, 8)).toThrow(RangeError);
  });
});
