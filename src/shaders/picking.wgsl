struct Node {
  position: vec4f,
  velocity: vec4f,
  color: vec4f,
  metadata: vec4f,
};

struct SceneUniforms {
  viewProjection: mat4x4f,
  cameraRight: vec4f,
  cameraUp: vec4f,
  cameraPosition: vec4f,
  viewport: vec4f,
  timing: vec4f,
  render: vec4f,
  themeA: vec4f,
  themeB: vec4f,
  reserved: vec4f,
};

struct SimUniforms {
  slot0: vec4f,
  slot1: vec4f,
  slot2: vec4f,
  slot3: vec4f,
};

struct PickResult {
  packed: atomic<u32>,
};

// slot0: pointerX(px), pointerY(px), nodeCount, extraHitRadius(px)
@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(0) @binding(1) var<storage, read> nodes: array<Node>;
@group(0) @binding(2) var<uniform> pick: SimUniforms;
@group(0) @binding(3) var<storage, read_write> result: PickResult;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
  let index = globalId.x;
  let nodeCount = min(u32(max(pick.slot0.z, 0.0)), arrayLength(&nodes));
  if (index >= nodeCount || index > 65534u) {
    return;
  }

  let node = nodes[index];
  let centerClip = scene.viewProjection * vec4f(node.position.xyz, 1.0);
  if (centerClip.w <= 0.00001) {
    return;
  }
  let edgeWorld = node.position.xyz + scene.cameraRight.xyz * node.position.w * scene.render.z;
  let edgeClip = scene.viewProjection * vec4f(edgeWorld, 1.0);
  let centerNdc = centerClip.xy / centerClip.w;
  let edgeNdc = edgeClip.xy / max(edgeClip.w, 0.00001);
  let centerPixels = vec2f(
    (centerNdc.x * 0.5 + 0.5) * scene.viewport.x,
    (1.0 - (centerNdc.y * 0.5 + 0.5)) * scene.viewport.y
  );
  let radiusPixels = length((edgeNdc - centerNdc) * scene.viewport.xy * 0.5);
  let pointer = pick.slot0.xy;
  let distancePixels = length(pointer - centerPixels);
  let hitRadius = max(radiusPixels + max(pick.slot0.w, 0.0), 2.0);
  if (distancePixels > hitRadius) {
    return;
  }

  // High 16 bits are normalized distance; low 16 bits are the node index.
  // Clearing to 0xffffffff before dispatch makes atomicMin select the nearest hit.
  let normalizedScore = clamp(distancePixels / hitRadius, 0.0, 1.0);
  let score = min(u32(round(normalizedScore * 65534.0)), 65534u);
  let packed = (score << 16u) | (index & 0xffffu);
  atomicMin(&result.packed, packed);
}
