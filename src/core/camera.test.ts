import { describe, expect, it } from 'vitest';
import { CameraController, ISOMETRIC_PITCH, ISOMETRIC_YAW } from './camera';

describe('CameraController', () => {
  it('updates its zoom target when a node is focused', () => {
    const camera = new CameraController();

    camera.focus([4, -2, 7]);

    expect(camera.targetCenter).toEqual([4, -2, 7]);
  });

  it('zooms without moving the current target', () => {
    const camera = new CameraController();
    camera.focus([4, -2, 7]);

    camera.dolly(-120);

    expect(camera.targetCenter).toEqual([4, -2, 7]);
    expect(camera.targetZoom).toBeLessThan(16);
  });

  it('uses configurable zoom bounds', () => {
    const camera = new CameraController();
    camera.setZoomBounds(0.9, 40);

    camera.dolly(-100_000);
    expect(camera.targetZoom).toBe(0.9);

    camera.dolly(100_000);
    expect(camera.targetZoom).toBe(40);
  });

  it('keeps the world point beneath the pointer fixed while zooming in 2D', () => {
    const camera = new CameraController();
    const rect = { left: 0, top: 0, width: 800, height: 600 } as DOMRect;
    const nx = 0.5;
    const aspect = rect.width / rect.height;
    const worldXBefore = camera.targetCenter[0] + nx * aspect * camera.targetZoom;

    camera.zoomAt(-180, 600, 300, rect);

    const worldXAfter = camera.targetCenter[0] + nx * aspect * camera.targetZoom;
    expect(worldXAfter).toBeCloseTo(worldXBefore);
  });

  it('enters 3D face-on from the current framing then aims isometric', () => {
    const camera = new CameraController();
    camera.zoom = 20;
    camera.targetZoom = 20;
    camera.center = [3, -1, 0];
    camera.targetCenter = [3, -1, 0];

    camera.setDimension('3d');

    expect(camera.yaw).toBe(0);
    expect(camera.pitch).toBe(0);
    expect(camera.targetYaw).toBeCloseTo(ISOMETRIC_YAW);
    expect(camera.targetPitch).toBeCloseTo(ISOMETRIC_PITCH);
    expect(camera.distance).toBeCloseTo(camera.distanceForZoom(20));
    expect(camera.targetCenter).toEqual([3, -1, 0]);
  });

  it('folds back to face-on when returning to 2D without moving the center', () => {
    const camera = new CameraController();
    camera.setDimension('3d');
    camera.center = [2, 4, -1];
    camera.targetCenter = [2, 4, -1];
    camera.distance = 40;
    camera.targetDistance = 40;

    camera.setDimension('2d');

    expect(camera.targetYaw).toBe(0);
    expect(camera.targetPitch).toBe(0);
    expect(camera.targetZoom).toBeCloseTo(camera.zoomForDistance(40));
    expect(camera.targetCenter).toEqual([2, 4, -1]);
  });

  it('keeps the subject framed in place during the blend (no position teleport)', () => {
    const camera = new CameraController();
    camera.center = [5, 2, 0];
    camera.targetCenter = [5, 2, 0];
    camera.zoom = 16;
    camera.setDimension('3d');

    const ortho = camera.frame(800, 600, 0);
    const early = camera.frame(800, 600, 0.05);

    // Face-on perspective looks at the same center; camera sits on +Z.
    expect(ortho.position[0]).toBeCloseTo(5);
    expect(ortho.position[1]).toBeCloseTo(2);
    expect(early.position[0]).toBeCloseTo(5);
    expect(early.position[1]).toBeCloseTo(2);
    expect(early.position[2]).toBeGreaterThan(0);
  });
});
