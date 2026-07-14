export const SPHERE_SEGMENTS = 32;
export const SPHERE_RINGS = 20;

/** Smooth UV sphere as a compact, non-indexed triangle list of unit positions. */
export function createUVSphere(segments = SPHERE_SEGMENTS, rings = SPHERE_RINGS): Float32Array {
  if (!Number.isInteger(segments) || segments < 3) {
    throw new RangeError('Sphere segments must be an integer of at least 3.');
  }
  if (!Number.isInteger(rings) || rings < 2) {
    throw new RangeError('Sphere rings must be an integer of at least 2.');
  }

  const positions: number[] = [];
  const point = (phi: number, theta: number): [number, number, number] => {
    if (phi === 0) return [0, 1, 0];
    if (phi === Math.PI) return [0, -1, 0];
    const sinPhi = Math.sin(phi);
    return [sinPhi * Math.cos(theta), Math.cos(phi), sinPhi * Math.sin(theta)];
  };

  for (let ring = 0; ring < rings; ring += 1) {
    const phi0 = (ring / rings) * Math.PI;
    const phi1 = ((ring + 1) / rings) * Math.PI;
    for (let segment = 0; segment < segments; segment += 1) {
      const theta0 = (segment / segments) * Math.PI * 2;
      const theta1 = ((segment + 1) / segments) * Math.PI * 2;
      const a = point(phi0, theta0);
      const b = point(phi1, theta0);
      const c = point(phi0, theta1);
      const d = point(phi1, theta1);
      // The two-triangle form collapses one triangle at each pole. Omitting
      // those zero-area triangles saves work; the remaining vertices use
      // counter-clockwise outward winding for back-face culling.
      if (ring > 0) {
        positions.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
      }
      if (ring < rings - 1) {
        positions.push(c[0], c[1], c[2], d[0], d[1], d[2], b[0], b[1], b[2]);
      }
    }
  }

  return new Float32Array(positions);
}

export const SPHERE_VERTEX_COUNT = createUVSphere().length / 3;
