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
  nodeRenderA: vec4f,
  nodeRenderB: vec4f,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(0) @binding(1) var<storage, read> nodes: array<Node>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) local: vec3f,
  @location(1) color: vec4f,
  @location(2) worldCenter: vec3f,
  @location(3) metadata: vec4f,
  @location(4) @interpolate(flat) instanceIndex: u32,
  @location(5) radius: f32,
  @location(6) squash: f32,
  @location(7) worldPosition: vec3f,
  @location(8) cubeness: f32,
};

struct VolumeSample {
  density: f32,
  filament: f32,
  core: f32,
  proximity: f32,
};

fn hash11(n: f32) -> f32 {
  return fract(sin(n * 127.1) * 43758.5453123);
}

fn nodeLocalBlend(instanceIndex: u32) -> f32 {
  let stagger = hash11(f32(instanceIndex) + 1.7) * 0.22;
  return smoothstep(stagger, stagger + 0.78, clamp(scene.timing.z, 0.0, 1.0));
}

fn sphereCubeHybrid(local: vec3f, cubeness: f32) -> vec3f {
  let sphere = normalize(local);
  let axes = abs(sphere);
  let m = max(axes.x, max(axes.y, axes.z));
  let cube = sphere / max(m, 1e-5);
  return mix(sphere, cube, clamp(cubeness, 0.0, 1.0));
}

fn transformLocal(local: vec3f, radius: f32, squash: f32, cubeness: f32, shell: f32) -> vec3f {
  let shaped = sphereCubeHybrid(local, cubeness);
  return shaped * radius * shell * vec3f(1.0, 1.0, squash);
}

@vertex
fn vs_main(
  @location(0) local: vec3f,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let node = nodes[instanceIndex];
  let radius = max(node.position.w * scene.render.z, 0.001);
  let localBlend = nodeLocalBlend(instanceIndex);
  let squash = mix(0.06, 1.0, localBlend);
  let cubeness = mix(0.0, 0.52, localBlend);
  let shaped = sphereCubeHybrid(local, cubeness);
  let worldPosition = node.position.xyz + transformLocal(local, radius, squash, cubeness, 1.0);

  var output: VertexOutput;
  output.position = scene.viewProjection * vec4f(worldPosition, 1.0);
  output.local = shaped;
  output.color = node.color;
  output.worldCenter = node.position.xyz;
  output.metadata = node.metadata;
  output.instanceIndex = instanceIndex;
  output.radius = radius;
  output.squash = squash;
  output.worldPosition = worldPosition;
  output.cubeness = cubeness;
  return output;
}

@vertex
fn vs_aura(
  @location(0) local: vec3f,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let node = nodes[instanceIndex];
  let radius = max(node.position.w * scene.render.z, 0.001);
  let localBlend = nodeLocalBlend(instanceIndex);
  let squash = mix(0.06, 1.0, localBlend);
  let cubeness = mix(0.0, 0.52, localBlend);
  let shell = 1.72;
  let shaped = sphereCubeHybrid(local, cubeness);
  let worldPosition = node.position.xyz + transformLocal(local, radius, squash, cubeness, shell);

  var output: VertexOutput;
  output.position = scene.viewProjection * vec4f(worldPosition, 1.0);
  output.local = shaped * shell;
  output.color = node.color;
  output.worldCenter = node.position.xyz;
  output.metadata = node.metadata;
  output.instanceIndex = instanceIndex;
  output.radius = radius;
  output.squash = squash;
  output.worldPosition = worldPosition;
  output.cubeness = cubeness;
  return output;
}

fn hash21(p: vec2f) -> f32 {
  let q = fract(p * vec2f(0.1031, 0.1030));
  let h = dot(q, q.yx + 33.33);
  return fract((q.x + h) * (q.y + h));
}

fn rotate2(point: vec2f, sineCosine: vec2f) -> vec2f {
  return vec2f(
    sineCosine.y * point.x - sineCosine.x * point.y,
    sineCosine.x * point.x + sineCosine.y * point.y
  );
}

fn volumeField(
  worldOffset: vec3f,
  seed: f32,
  rotationXY: vec2f,
  rotationXZ: vec2f,
  domainOffset: vec3f
) -> VolumeSample {
  var q = worldOffset;
  let rotatedXY = rotate2(q.xy, rotationXY);
  q = vec3f(rotatedXY, q.z);
  let rotatedXZ = rotate2(q.xz, rotationXZ);
  q = vec3f(rotatedXZ.x, q.y, rotatedXZ.y);

  let r2 = dot(worldOffset, worldOffset);
  let radius = sqrt(r2);
  let detailScale = clamp(scene.nodeRenderA.x, 0.6, 1.8);
  let domain = q * (5.15 * detailScale) + domainOffset;

  let warp = scene.nodeRenderA.y * vec3f(
    sin(domain.y * 0.73 + domain.z),
    sin(domain.z * 0.81 - domain.x),
    sin(domain.x * 0.67 + domain.y)
  );
  let p = domain + warp;
  let gyroid = dot(sin(p), cos(p * 0.618).yzx) * (1.0 / 3.0);
  var layeredField = gyroid;
  if (scene.nodeRenderB.x >= 1.5) {
    let second = dot(sin(p.yzx * 1.27 + seed), cos(p.zxy * 0.79 - seed)) * (1.0 / 3.0);
    layeredField += second * 0.22;
  }
  if (scene.nodeRenderB.x >= 2.5) {
    let third = dot(sin(p.zxy * 2.03 - seed * 1.7), cos(p.xzy * 1.41 + seed * 0.8)) * (1.0 / 3.0);
    layeredField += third * 0.10;
  }
  let fieldDistance = abs(layeredField);
  let proximity = exp(-72.0 * fieldDistance * fieldDistance);

  let interior = 1.0 - smoothstep(0.72, 1.0, radius);
  let shell = exp(-19.0 * (radius - 0.58) * (radius - 0.58));
  let corona = exp(-58.0 * (radius - 0.82) * (radius - 0.82));
  let core = exp(-11.5 * r2);
  let filament = proximity * (shell * 0.82 + corona * 0.32) * interior;
  let density = (core * 1.58 + filament * 1.18) * interior;
  return VolumeSample(density, filament, core, proximity);
}

fn toneMap(color: vec3f) -> vec3f {
  let positive = max(color, vec3f(0.0));
  let peak = max(positive.x, max(positive.y, positive.z));
  return positive / (1.0 + peak);
}

// Ray vs sphere in ellipsoid-local space (already scaled by 1/squash on Z).
fn intersectSphere(origin: vec3f, direction: vec3f, radius: f32) -> vec2f {
  let a = dot(direction, direction);
  let b = 2.0 * dot(origin, direction);
  let c = dot(origin, origin) - radius * radius;
  let discriminant = b * b - 4.0 * a * c;
  if (discriminant < 0.0 || a < 1e-8) {
    return vec2f(-1.0, -1.0);
  }
  let root = sqrt(discriminant);
  let t0 = (-b - root) / (2.0 * a);
  let t1 = (-b + root) / (2.0 * a);
  return vec2f(t0, t1);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let scale = vec3f(1.0, 1.0, max(input.squash, 0.06));
  let invScale = 1.0 / scale;
  let camLocal = (scene.cameraPosition.xyz - input.worldCenter) * invScale / max(input.radius, 0.001);
  let surfaceLocal = input.local;
  var direction = surfaceLocal - camLocal;
  let directionLength = length(direction);
  if (directionLength < 1e-5) {
    discard;
  }
  direction /= directionLength;

  // Hybrid corners stick out past the unit sphere; march a slightly larger bound.
  let boundRadius = mix(1.0, 1.22, clamp(input.cubeness, 0.0, 1.0));
  let hit = intersectSphere(camLocal, direction, boundRadius);
  if (hit.y < 0.0) {
    discard;
  }
  let tEnter = max(hit.x, 0.0);
  let tExit = hit.y;
  let chordLength = max(tExit - tEnter, 0.0001);

  let animated = step(0.5, scene.render.x);
  let time = scene.timing.x * animated;
  let requestedSteps = u32(round(clamp(scene.render.y, 8.0, 40.0)));
  let pixelFootprint = max(fwidth(input.local.x), max(fwidth(input.local.y), fwidth(input.local.z)));
  let pixelRadius = 1.0 / max(pixelFootprint, 0.001);
  let lod = smoothstep(5.0, 22.0, pixelRadius);
  let lodCeiling = 8u + u32(round(lod * 32.0));
  let reducedSteps = min(requestedSteps, lodCeiling);
  let lodStrength = clamp(scene.nodeRenderA.w, 0.0, 1.0);
  let balancedSteps = u32(round(mix(f32(requestedSteps), f32(reducedSteps), lodStrength)));
  let interaction = max(clamp(input.metadata.y, 0.0, 1.0), clamp(input.metadata.z, 0.0, 1.0) * 0.64);
  let activeSteps = min(requestedSteps, min(40u, balancedSteps + u32(round(interaction * 4.0))));
  let baseStep = chordLength / f32(activeSteps);
  let seed = fract(f32(input.instanceIndex) * 0.6180339 + input.metadata.x * 0.173);
  let jitterPixel = floor(input.position.xy);
  let jitter = hash21(jitterPixel + vec2f(seed * 41.0, seed * 67.0));
  let jitterOffset = mix(0.5, jitter, clamp(scene.nodeRenderA.z, 0.0, 1.0));
  let angleXY = seed * 2.17 + time * 0.045;
  let angleXZ = seed * 1.31 - time * 0.032;
  let rotationXY = vec2f(sin(angleXY), cos(angleXY));
  let rotationXZ = vec2f(sin(angleXZ), cos(angleXZ));
  let domainOffset = vec3f(0.0, time * 0.13, -time * 0.09)
    + vec3f(seed * 3.1, seed * 1.7, seed * 2.3);

  let regionColor = max(input.color.rgb, vec3f(0.0));
  let deepBlue = mix(vec3f(0.006, 0.030, 0.16), regionColor * 0.58, 0.74);
  let electricBlue = mix(vec3f(0.015, 0.32, 1.65), regionColor * 1.45, 0.72);
  let cyan = mix(vec3f(0.10, 0.88, 2.20), regionColor * 1.58, 0.68);
  let hotCore = mix(regionColor * 1.18 + vec3f(0.18, 0.24, 0.38), vec3f(1.05, 1.42, 2.05), 0.62);
  let pulse = 1.0 + scene.reserved.y * 0.09 * sin(time * 1.65 + seed * 12.0);

  var radiance = vec3f(0.0);
  var transmittance = 1.0;
  var traveled = 0.0;
  for (var i = 0u; i < 40u; i += 1u) {
    if (i >= activeSteps || transmittance < 0.004) {
      break;
    }

    let sampleDistance = min(traveled + baseStep * jitterOffset, chordLength);
    let localPoint = camLocal + direction * (tEnter + sampleDistance);
    let worldOffset = localPoint * scale;
    let volume = volumeField(worldOffset, seed, rotationXY, rotationXZ, domainOffset);

    let stepLength = min(chordLength - traveled, baseStep);
    let extinction = volume.density * 0.58;
    let sampleAlpha = 1.0 - exp(-extinction * stepLength);
    let coreHeat = smoothstep(0.12, 0.94, volume.core);
    let filamentHeat = smoothstep(0.08, 0.82, volume.filament);
    var sampleColor = mix(deepBlue, electricBlue, filamentHeat);
    sampleColor = mix(sampleColor, cyan, filamentHeat * filamentHeat * 0.66);
    sampleColor = mix(sampleColor, hotCore, coreHeat * coreHeat * 0.84);

    radiance += sampleColor * transmittance * volume.density * stepLength * 2.75 * pulse;
    let filamentGlow = min(volume.proximity * volume.proximity * stepLength * 0.52, 0.22);
    radiance += electricBlue * transmittance * filamentGlow;
    transmittance *= 1.0 - sampleAlpha;
    traveled += stepLength;
  }

  let radialDistance = length(input.local.xy);
  let aa = max(fwidth(radialDistance), 0.0015);
  let edgeCoverage = 1.0 - smoothstep(1.0 - aa * 1.35, 1.0 + aa, length(input.local));
  let coreSilhouette = exp(-13.0 * dot(input.local, input.local));
  let opacity = clamp(((1.0 - transmittance) * 0.84 + coreSilhouette * 0.12) * input.color.a * max(edgeCoverage, 0.85), 0.0, 0.86);
  if (opacity < 0.002) {
    discard;
  }

  let exposure = max(scene.render.w, 0.1) * (1.0 + interaction * 0.16);
  let resolvedCore = electricBlue * exp(-3.6 * dot(input.local, input.local)) * 0.20
    + hotCore * coreSilhouette * 0.58;
  var mapped = toneMap((radiance + resolvedCore) * exposure);
  mapped += vec3f(0.24, 0.72, 1.0) * interaction * exp(-42.0 * abs(length(input.local) - 0.99));

  return vec4f(max(mapped, vec3f(0.0)), opacity);
}

@fragment
fn fs_aura(input: VertexOutput) -> @location(0) vec4f {
  let radialDistance = length(input.local);
  if (radialDistance > 1.72) {
    discard;
  }

  let seed = fract(f32(input.instanceIndex) * 0.6180339 + input.metadata.x * 0.173);
  let animated = step(0.5, scene.render.x);
  let time = scene.timing.x * animated;
  let interaction = max(clamp(input.metadata.y, 0.0, 1.0), clamp(input.metadata.z, 0.0, 1.0) * 0.64);
  let pulse = 1.0 + scene.reserved.y * 0.11 * sin(time * 1.65 + seed * 12.0);
  let glowStrength = max(scene.reserved.x, 0.0);

  let outside = max(radialDistance - 0.82, 0.0);
  let cutoff = 1.0 - smoothstep(1.30, 1.72, radialDistance);
  let broad = exp(-4.6 * outside) * cutoff;
  let bloom = exp(-13.0 * abs(radialDistance - 0.94));
  let coreBloom = exp(-3.8 * radialDistance * radialDistance);
  let selectionRing = exp(-45.0 * abs(radialDistance - 1.04)) * interaction;
  let energy = (broad * 0.090 + bloom * 0.080 + coreBloom * 0.055) * glowStrength * pulse
    + selectionRing * 0.12;
  if (energy < 0.001) {
    discard;
  }

  let regionAura = mix(input.color.rgb * 1.35, vec3f(0.08, 0.52, 1.55), 0.28);
  let auraColor = mix(regionAura, regionAura * 1.12 + vec3f(0.08, 0.16, 0.28), bloom * 0.54 + interaction * 0.18);
  return vec4f(auraColor * energy, clamp(energy * 0.32, 0.0, 0.16));
}
