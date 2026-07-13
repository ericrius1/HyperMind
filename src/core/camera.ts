import { clamp, damp, mat4LookAt, mat4Multiply, mat4Ortho, mat4Perspective, vec3Cross, vec3Normalize, vec3Sub, type Mat4 } from './math';
import type { CameraMode, Vec3, ViewDimension } from './types';

export interface CameraFrame {
  viewProjection: Mat4;
  position: Vec3;
  right: Vec3;
  up: Vec3;
  zoom: number;
}

export class CameraController {
  dimension: ViewDimension = '2d';
  mode: CameraMode = 'orbit';
  center: Vec3 = [0, 0, 0];
  targetCenter: Vec3 = [0, 0, 0];
  zoom = 16;
  targetZoom = 16;
  yaw = 0.65;
  pitch = 0.58;
  targetYaw = 0.65;
  targetPitch = 0.58;
  distance = 28;
  targetDistance = 28;
  private keys = new Set<string>();

  setDimension(dimension: ViewDimension): void {
    this.dimension = dimension;
    if (dimension === '3d') {
      this.targetDistance = Math.max(16, this.zoom * 1.6);
    }
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
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
    if (this.dimension === '2d') this.targetZoom = clamp(this.targetZoom * factor, 1.4, 90);
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
    const nextZoom = clamp(oldZoom * Math.exp(delta * 0.0012), 1.4, 90);
    this.targetCenter[0] += nx * aspect * (oldZoom - nextZoom);
    this.targetCenter[1] += ny * (oldZoom - nextZoom);
    this.targetZoom = nextZoom;
  }

  update(dt: number): void {
    const response = this.dimension === '2d' ? 16 : 11;
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

  frame(width: number, height: number): CameraFrame {
    const aspect = width / Math.max(1, height);
    if (this.dimension === '2d') {
      const halfHeight = this.zoom;
      const halfWidth = halfHeight * aspect;
      const projection = mat4Ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, -200, 200);
      const position: Vec3 = [this.center[0], this.center[1], 48];
      const view = mat4LookAt(position, this.center, [0, 1, 0]);
      return { viewProjection: mat4Multiply(projection, view), position, right: [1, 0, 0], up: [0, 1, 0], zoom: this.zoom };
    }
    const { position, right, up } = this.basis();
    const projection = mat4Perspective(Math.PI / 4.2, aspect, 0.08, 400);
    const view = mat4LookAt(position, this.center, up);
    return { viewProjection: mat4Multiply(projection, view), position, right, up, zoom: this.distance };
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
