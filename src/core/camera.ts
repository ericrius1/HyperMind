import { clamp, damp, mat4LookAt, mat4Multiply, mat4Ortho, mat4Perspective, vec3Cross, vec3Normalize, vec3Sub, type Mat4 } from './math';
import type { CameraMode, Vec3, ViewDimension } from './types';

export interface CameraFrame {
  viewProjection: Mat4;
  position: Vec3;
  right: Vec3;
  up: Vec3;
  zoom: number;
}

/** ~45° yaw / isometric pitch — classic three-quarter view. */
export const ISOMETRIC_YAW = Math.PI / 4;
export const ISOMETRIC_PITCH = Math.atan(1 / Math.sqrt(2));
const PERSPECTIVE_FOV = Math.PI / 4.2;

export class CameraController {
  dimension: ViewDimension = '2d';
  mode: CameraMode = 'orbit';
  center: Vec3 = [0, 0, 0];
  targetCenter: Vec3 = [0, 0, 0];
  zoom = 16;
  targetZoom = 16;
  yaw = 0;
  pitch = 0;
  targetYaw = 0;
  targetPitch = 0;
  distance = 28;
  targetDistance = 28;
  private minZoom = 0.9;
  private maxZoom = 90;
  private keys = new Set<string>();
  private transitioning = false;

  setDimension(dimension: ViewDimension): void {
    const previous = this.dimension;
    this.dimension = dimension;
    if (dimension === '3d' && previous !== '3d') {
      // Match the current 2D framing: face-on along +Z, same subject scale.
      this.yaw = 0;
      this.pitch = 0;
      this.targetYaw = ISOMETRIC_YAW;
      this.targetPitch = ISOMETRIC_PITCH;
      const matched = this.distanceForZoom(this.zoom);
      this.distance = matched;
      this.targetDistance = matched;
      this.transitioning = true;
    } else if (dimension === '2d' && previous !== '2d') {
      // Fold back to face-on before ortho takes over; keep the same center.
      this.targetYaw = 0;
      this.targetPitch = 0;
      this.targetZoom = clamp(this.zoomForDistance(this.distance), this.minZoom, this.maxZoom);
      this.transitioning = true;
    }
  }

  setTransitioning(active: boolean): void {
    this.transitioning = active;
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
  }

  setZoomBounds(minZoom: number, maxZoom: number): void {
    this.minZoom = Math.max(0.05, Math.min(minZoom, maxZoom));
    this.maxZoom = Math.max(this.minZoom, maxZoom);
    this.targetZoom = clamp(this.targetZoom, this.minZoom, this.maxZoom);
    this.zoom = clamp(this.zoom, this.minZoom, this.maxZoom);
  }

  focus(position: Vec3): void {
    this.targetCenter = [...position];
  }

  key(code: string, pressed: boolean): void {
    if (pressed) this.keys.add(code);
    else this.keys.delete(code);
  }

  pan(dxPixels: number, dyPixels: number, viewportHeight: number): void {
    const scale = (this.dimension === '2d' ? this.zoom : this.distance * 0.72) * 2 / Math.max(1, viewportHeight);
    if (this.dimension === '2d') {
      this.targetCenter[0] -= dxPixels * scale;
      this.targetCenter[1] += dyPixels * scale;
      return;
    }
    const { right, up } = this.basis();
    this.targetCenter[0] += (-right[0] * dxPixels + up[0] * dyPixels) * scale;
    this.targetCenter[1] += (-right[1] * dxPixels + up[1] * dyPixels) * scale;
    this.targetCenter[2] += (-right[2] * dxPixels + up[2] * dyPixels) * scale;
  }

  orbit(dxPixels: number, dyPixels: number): void {
    this.targetYaw -= dxPixels * 0.005;
    this.targetPitch = clamp(this.targetPitch - dyPixels * 0.005, -1.42, 1.42);
  }

  dolly(delta: number): void {
    const factor = Math.exp(delta * 0.0012);
    if (this.dimension === '2d') this.targetZoom = clamp(this.targetZoom * factor, this.minZoom, this.maxZoom);
    else this.targetDistance = clamp(this.targetDistance * factor, 4, 120);
  }

  zoomAt(delta: number, clientX: number, clientY: number, rect: DOMRect): void {
    if (this.dimension !== '2d') {
      this.dolly(delta);
      return;
    }
    const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = 1 - ((clientY - rect.top) / Math.max(1, rect.height)) * 2;
    const aspect = rect.width / Math.max(1, rect.height);
    const oldZoom = this.targetZoom;
    const nextZoom = clamp(oldZoom * Math.exp(delta * 0.0012), this.minZoom, this.maxZoom);
    this.targetCenter[0] += nx * aspect * (oldZoom - nextZoom);
    this.targetCenter[1] += ny * (oldZoom - nextZoom);
    this.targetZoom = nextZoom;
  }

  update(dt: number): void {
    // ~3s settle while morphing; snappy once settled.
    const response = this.transitioning ? 1.2 : this.dimension === '2d' ? 16 : 11;
    this.zoom = damp(this.zoom, this.targetZoom, response, dt);
    this.distance = damp(this.distance, this.targetDistance, response, dt);
    this.yaw = damp(this.yaw, this.targetYaw, response, dt);
    this.pitch = damp(this.pitch, this.targetPitch, response, dt);
    for (let axis = 0; axis < 3; axis += 1) {
      this.center[axis] = damp(this.center[axis]!, this.targetCenter[axis]!, response, dt);
    }

    if (this.dimension === '3d' && this.mode === 'fly' && this.keys.size > 0) {
      const forward: Vec3 = [
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        -Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch),
      ];
      const right = vec3Normalize(vec3Cross(forward, [0, 1, 0]));
      const speed = dt * Math.max(5, this.distance * 0.45);
      const move: Vec3 = [0, 0, 0];
      const add = (direction: Vec3, amount: number): void => {
        move[0] += direction[0] * amount;
        move[1] += direction[1] * amount;
        move[2] += direction[2] * amount;
      };
      if (this.keys.has('KeyW')) add(forward, speed);
      if (this.keys.has('KeyS')) add(forward, -speed);
      if (this.keys.has('KeyA')) add(right, -speed);
      if (this.keys.has('KeyD')) add(right, speed);
      if (this.keys.has('Space')) move[1] += speed;
      if (this.keys.has('ShiftLeft')) move[1] -= speed;
      this.targetCenter[0] += move[0];
      this.targetCenter[1] += move[1];
      this.targetCenter[2] += move[2];
    }
  }

  /**
   * Blend 0 = ortho 2D. Blend > 0 = perspective from the current orbit pose.
   * No camera-position lerp — the subject stays where it is; only angles/projection change.
   */
  frame(width: number, height: number, dimensionBlend = this.dimension === '3d' ? 1 : 0): CameraFrame {
    const aspect = width / Math.max(1, height);
    const blend = clamp(dimensionBlend, 0, 1);
    if (blend <= 0.0001) return this.frameOrtho(aspect);
    return this.framePerspective(aspect);
  }

  screenDeltaToWorld(dxPixels: number, dyPixels: number, viewportHeight: number): Vec3 {
    const scale = (this.dimension === '2d' ? this.zoom : this.distance * 0.42) * 2 / Math.max(1, viewportHeight);
    const { right, up } = this.dimension === '2d' ? { right: [1, 0, 0] as Vec3, up: [0, 1, 0] as Vec3 } : this.basis();
    return [
      right[0] * dxPixels * scale - up[0] * dyPixels * scale,
      right[1] * dxPixels * scale - up[1] * dyPixels * scale,
      right[2] * dxPixels * scale - up[2] * dyPixels * scale,
    ];
  }

  screenToWorld2D(clientX: number, clientY: number, rect: DOMRect): Vec3 {
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((clientY - rect.top) / rect.height) * 2;
    const aspect = rect.width / Math.max(1, rect.height);
    return [this.center[0] + nx * this.zoom * aspect, this.center[1] + ny * this.zoom, 0];
  }

  distanceForZoom(zoom: number): number {
    return Math.max(4, zoom / Math.tan(PERSPECTIVE_FOV * 0.5));
  }

  zoomForDistance(distance: number): number {
    return distance * Math.tan(PERSPECTIVE_FOV * 0.5);
  }

  private frameOrtho(aspect: number): CameraFrame {
    const halfHeight = this.zoom;
    const halfWidth = halfHeight * aspect;
    const projection = mat4Ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, -200, 200);
    const position: Vec3 = [this.center[0], this.center[1], 48];
    const view = mat4LookAt(position, this.center, [0, 1, 0]);
    return { viewProjection: mat4Multiply(projection, view), position, right: [1, 0, 0], up: [0, 1, 0], zoom: this.zoom };
  }

  private framePerspective(aspect: number): CameraFrame {
    const { position, right, up } = this.basis();
    const projection = mat4Perspective(PERSPECTIVE_FOV, aspect, 0.08, 400);
    const view = mat4LookAt(position, this.center, up);
    return { viewProjection: mat4Multiply(projection, view), position, right, up, zoom: this.distance };
  }

  private basis(): { position: Vec3; right: Vec3; up: Vec3 } {
    const cosPitch = Math.cos(this.pitch);
    const offset: Vec3 = [
      Math.sin(this.yaw) * cosPitch * this.distance,
      Math.sin(this.pitch) * this.distance,
      Math.cos(this.yaw) * cosPitch * this.distance,
    ];
    const position: Vec3 = [this.center[0] + offset[0], this.center[1] + offset[1], this.center[2] + offset[2]];
    const forward = vec3Normalize(vec3Sub(this.center, position));
    const right = vec3Normalize(vec3Cross(forward, [0, 1, 0]));
    const up = vec3Normalize(vec3Cross(right, forward));
    return { position, right, up };
  }
}
