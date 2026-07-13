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

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(0) @binding(1) var<storage, read> nodes: array<Node>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) color: vec4f,
  @location(2) worldCenter: vec3f,
  @location(3) metadata: vec4f,
  @location(4) @interpolate(flat) instanceIndex: u32,
};

struct VolumeSample {
  density: f32,
  filament: f32,
  core: f32,
  proximity: f32,
};

fn quadVertex(index: u32) -> vec2f {
  let vertices = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  return vertices[index];
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let node = nodes[instanceIndex];
  let corner = quadVertex(vertexIndex);
  let radius = max(node.position.w * scene.render.z, 0.001);
  let extent = 1.72;
  let worldPosition = node.position.xyz
    + scene.cameraRight.xyz * corner.x * radius * extent
    + scene.cameraUp.xyz * corner.y * radius * extent;

  var output: VertexOutput;
  output.position = scene.viewProjection * vec4f(worldPosition, 1.0);
  output.local = corner * extent;
  output.color = node.color;
  output.worldCenter = node.position.xyz;
  output.metadata = node.metadata;
  output.instanceIndex = instanceIndex;
  return output;
}

fn hash21(p: vec2f) -> f32 {
  let q = fract(p * vec2f(0.1031, 0.1030));
  let h = dot(q, q.yx + 33.33);
  return fract((q.x + h) * (q.y + h));
}

fn rotate2(point: vec2f, angle: f32) -> vec2f {
  let sine = sin(angle);
  let cosine = cos(angle);
  return vec2f(cosine * point.x - sine * point.y, sine * point.x + cosine * point.y);
}

fn volumeField(worldOffset: vec3f, seed: f32, time: f32) -> VolumeSample {
  var q = worldOffset;
  let rotatedXY = rotate2(q.xy, seed * 2.17 + time * 0.045);
  q = vec3f(rotatedXY, q.z);
  let rotatedXZ = rotate2(q.xz, seed * 1.31 - time * 0.032);
  q = vec3f(rotatedXZ.x, q.y, rotatedXZ.y);

  let r2 = dot(worldOffset, worldOffset);
  let radius = sqrt(r2);
  let flow = vec3f(0.0, time * 0.13, -time * 0.09);
  let domain = q * 5.15 + flow + vec3f(seed * 3.1, seed * 1.7, seed * 2.3);

  // A cheap warped gyroid-like field replaces hundreds of hash lookups per ray.
  let warp = 0.17 * vec3f(
    sin(domain.y * 0.73 + domain.z),
    sin(domain.z * 0.81 - domain.x),
    sin(domain.x * 0.67 + domain.y)
  );
  let p = domain + warp;
  let gyroid = dot(sin(p), cos(p * 0.618).yzx) * (1.0 / 3.0);
  let second = dot(sin(p.yzx * 1.27 + seed), cos(p.zxy * 0.79 - seed)) * (1.0 / 3.0);
  let fieldDistance = abs(gyroid + second * 0.22);
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
  return vec3f(1.0) - exp(-max(color, vec3f(0.0)));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let radialDistance = length(input.local);
  let aa = max(fwidth(radialDistance), 0.0015);
  if (radialDistance > 1.0 + aa) {
    discard;
  }

  let sphereRadiusSquared = max(1.0 - dot(input.local, input.local), 0.0);
  let zExtent = sqrt(sphereRadiusSquared);
  let chordLength = max(2.0 * zExtent, 0.0001);
  let animated = step(0.5, scene.render.x);
  let time = scene.timing.x * animated;
  let quality = clamp(scene.render.y, 0.0, 1.0);
  let requestedSteps = 8u + u32(round(quality * 16.0));
  let pixelRadius = 1.0 / max(fwidth(input.local.x), 0.001);
  let lod = smoothstep(5.0, 22.0, pixelRadius);
  let lodSteps = 10u + u32(round(lod * 14.0));
  let interaction = max(clamp(input.metadata.y, 0.0, 1.0), clamp(input.metadata.z, 0.0, 1.0) * 0.64);
  let activeSteps = min(requestedSteps, min(24u, lodSteps + u32(round(interaction * 4.0))));
  let baseStep = chordLength / f32(activeSteps);
  let seed = fract(f32(input.instanceIndex) * 0.6180339 + input.metadata.x * 0.173);
  let jitterCell = floor((input.local + vec2f(1.75)) * 96.0);
  let jitter = hash21(jitterCell + vec2f(seed * 41.0, seed * 67.0));
  let facing = normalize(scene.cameraPosition.xyz - input.worldCenter);

  let deepBlue = mix(vec3f(0.008, 0.045, 0.23), scene.themeA.rgb * 0.28, 0.22);
  let electricBlue = mix(vec3f(0.015, 0.32, 1.65), scene.themeB.rgb, 0.18);
  let cyan = vec3f(0.10, 0.88, 2.20);
  let hotCore = vec3f(1.05, 1.42, 2.05);
  let pulse = 1.0 + scene.reserved.y * 0.09 * sin(time * 1.65 + seed * 12.0);

  var radiance = vec3f(0.0);
  var transmittance = 1.0;
  var traveled = min(jitter * baseStep * 0.82, chordLength);
  for (var i = 0u; i < 24u; i += 1u) {
    if (i >= activeSteps || traveled >= chordLength || transmittance < 0.004) {
      break;
    }

    let z = zExtent - traveled;
    let localPoint = vec3f(input.local, z);
    let worldOffset = scene.cameraRight.xyz * localPoint.x
      + scene.cameraUp.xyz * localPoint.y
      + facing * localPoint.z;
    let volume = volumeField(worldOffset, seed, time);

    // Density-guided steps spend samples on the luminous structures, not empty space.
    let nearFeature = clamp(max(volume.proximity, volume.core * 0.78), 0.0, 1.0);
    let stepLength = min(chordLength - traveled, mix(baseStep * 1.72, baseStep * 0.46, nearFeature));
    let extinction = volume.density * 0.58;
    let sampleAlpha = 1.0 - exp(-extinction * stepLength);
    let coreHeat = smoothstep(0.12, 0.94, volume.core);
    let filamentHeat = smoothstep(0.08, 0.82, volume.filament);
    var sampleColor = mix(deepBlue, electricBlue, filamentHeat);
    sampleColor = mix(sampleColor, cyan, filamentHeat * filamentHeat * 0.66);
    sampleColor = mix(sampleColor, hotCore, coreHeat * coreHeat * 0.84);

    radiance += sampleColor * transmittance * volume.density * stepLength * 2.75 * pulse;
    // Restrained inverse-distance emission borrows the post's glow accumulation idea.
    let filamentGlow = min(volume.proximity * volume.proximity * stepLength * 0.52, 0.22);
    radiance += electricBlue * transmittance * filamentGlow;
    transmittance *= 1.0 - sampleAlpha;
    traveled += max(stepLength, 0.0025);
  }

  let edgeCoverage = 1.0 - smoothstep(1.0 - aa * 1.35, 1.0 + aa, radialDistance);
  let coreSilhouette = exp(-13.0 * radialDistance * radialDistance);
  let opacity = clamp(((1.0 - transmittance) * 0.84 + coreSilhouette * 0.12) * input.color.a * edgeCoverage, 0.0, 0.86);
  if (opacity < 0.002) {
    discard;
  }

  let exposure = max(scene.render.w, 0.1) * (1.0 + interaction * 0.16);
  let resolvedCore = electricBlue * exp(-3.6 * radialDistance * radialDistance) * 0.16
    + hotCore * coreSilhouette * 0.70;
  var mapped = toneMap((radiance + resolvedCore) * exposure) * edgeCoverage;
  mapped += vec3f(0.24, 0.72, 1.0) * interaction * exp(-42.0 * abs(radialDistance - 0.99));

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

  let auraColor = mix(vec3f(0.015, 0.30, 1.35), vec3f(0.18, 0.82, 1.75), bloom * 0.72 + interaction * 0.25);
  return vec4f(auraColor * energy, clamp(energy * 0.32, 0.0, 0.16));
}
