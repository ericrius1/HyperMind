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

// Packed atomic-min key:
//   bit 31      = tolerance-only hit (visual silhouette hits win first)
//   bits 19..30 = linear front-surface depth
//   bits 8..18  = normalized pointer distance
//   bits 0..7   = node index (the graph is capped at 256 nodes)
const PICK_DEPTH_RANGE: f32 = 400.0;
const PICK_DEPTH_MAX: u32 = 4094u;
const PICK_DISTANCE_MAX: u32 = 2046u;
const PICK_INDEX_MASK: u32 = 255u;

// slot0: pointerX(px), pointerY(px), nodeCount, extraHitRadius(px)
@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(0) @binding(1) var<storage, read> nodes: array<Node>;
@group(0) @binding(2) var<uniform> pick: SimUniforms;
@group(0) @binding(3) var<storage, read_write> result: PickResult;

fn hash11(n: f32) -> f32 {
  return fract(sin(n * 127.1) * 43758.5453123);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
  let index = globalId.x;
  let nodeCount = min(u32(max(pick.slot0.z, 0.0)), arrayLength(&nodes));
  if (index >= nodeCount || index > PICK_INDEX_MASK) {
    return;
  }

  let node = nodes[index];
  let centerClip = scene.viewProjection * vec4f(node.position.xyz, 1.0);
  if (centerClip.w <= 0.00001) {
    return;
  }

  let radius = max(node.position.w * scene.render.z, 0.001);
  let stagger = hash11(f32(index) + 1.7) * 0.22;
  let localBlend = smoothstep(stagger, stagger + 0.78, clamp(scene.timing.z, 0.0, 1.0));
  let squash = mix(0.06, 1.0, localBlend);
  let cubeness = mix(0.0, 0.52, localBlend);
  // Hybrid silhouette is slightly larger than a pure sphere along face axes.
  let silhouette = mix(1.0, 1.12, cubeness);
  // Project the silhouette of the squashed hybrid along camera axes.
  let edgeRight = node.position.xyz + scene.cameraRight.xyz * radius * silhouette;
  let edgeUp = node.position.xyz + scene.cameraUp.xyz * radius * silhouette;
  let edgeDepth = node.position.xyz
    + normalize(cross(scene.cameraRight.xyz, scene.cameraUp.xyz)) * radius * squash * silhouette;

  let centerNdc = centerClip.xy / centerClip.w;
  let rightClip = scene.viewProjection * vec4f(edgeRight, 1.0);
  let upClip = scene.viewProjection * vec4f(edgeUp, 1.0);
  let depthClip = scene.viewProjection * vec4f(edgeDepth, 1.0);
  let rightNdc = rightClip.xy / max(rightClip.w, 0.00001);
  let upNdc = upClip.xy / max(upClip.w, 0.00001);
  let depthNdc = depthClip.xy / max(depthClip.w, 0.00001);

  let centerPixels = vec2f(
    (centerNdc.x * 0.5 + 0.5) * scene.viewport.x,
    (1.0 - (centerNdc.y * 0.5 + 0.5)) * scene.viewport.y
  );
  let radiusPixels = max(
    length((rightNdc - centerNdc) * scene.viewport.xy * 0.5),
    max(
      length((upNdc - centerNdc) * scene.viewport.xy * 0.5),
      length((depthNdc - centerNdc) * scene.viewport.xy * 0.5)
    )
  );
  let pointer = pick.slot0.xy;
  let distancePixels = length(pointer - centerPixels);
  let visualRadius = max(radiusPixels, 2.0);
  let hitRadius = visualRadius + max(pick.slot0.w, 0.0);
  if (distancePixels > hitRadius) {
    return;
  }

  // Match the render pass's depth behavior: among overlapping visible
  // silhouettes, choose the node whose hybrid surface is closest to camera.
  // A linear camera-space measure avoids the precision collapse of perspective
  // NDC depth for nodes far from the near plane.
  let cameraBack = normalize(cross(scene.cameraRight.xyz, scene.cameraUp.xyz));
  let axisScale = vec3f(1.0, 1.0, squash);
  let sphereSupport = length(cameraBack * axisScale);
  let cubeSupport = dot(abs(cameraBack), axisScale);
  let depthSupport = radius * mix(sphereSupport, cubeSupport, cubeness);
  let centerDepth = dot(scene.cameraPosition.xyz - node.position.xyz, cameraBack);
  let frontDepth = max(centerDepth - depthSupport, 0.0);

  let toleranceOnly = select(0u, 1u, distancePixels > visualRadius);
  let depthScore = min(
    u32(round(clamp(frontDepth / PICK_DEPTH_RANGE, 0.0, 1.0) * f32(PICK_DEPTH_MAX))),
    PICK_DEPTH_MAX
  );
  let distanceScore = min(
    u32(round(clamp(distancePixels / max(hitRadius, 0.00001), 0.0, 1.0) * f32(PICK_DISTANCE_MAX))),
    PICK_DISTANCE_MAX
  );
  let packed = (toleranceOnly << 31u)
    | (depthScore << 19u)
    | (distanceScore << 8u)
    | (index & PICK_INDEX_MASK);
  atomicMin(&result.packed, packed);
}
