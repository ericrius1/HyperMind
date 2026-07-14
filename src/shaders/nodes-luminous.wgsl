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
  @location(0) worldNormal: vec3f,
  @location(1) color: vec4f,
  @location(2) metadata: vec4f,
  @location(3) worldPosition: vec3f,
  @location(4) worldCenter: vec3f,
  @location(5) radius: f32,
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
  let scale = vec3f(1.0, 1.0, squash);
  let shaped = sphereCubeHybrid(local, cubeness);
  let worldPosition = node.position.xyz + shaped * radius * scale;
  let worldNormal = normalize(shaped / scale);

  var output: VertexOutput;
  output.position = scene.viewProjection * vec4f(worldPosition, 1.0);
  output.worldNormal = worldNormal;
  output.color = node.color;
  output.metadata = node.metadata;
  output.worldPosition = worldPosition;
  output.worldCenter = node.position.xyz;
  output.radius = radius;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let viewDir = normalize(scene.cameraPosition.xyz - input.worldPosition);
  let facing = max(dot(normal, viewDir), 0.0);
  let fresnel = pow(1.0 - facing, 2.7);
  let animated = step(0.5, scene.render.x);
  let time = scene.timing.x * animated;

  let camOffset = input.worldPosition - input.worldCenter;
  let camLocal = vec2f(
    dot(camOffset, scene.cameraRight.xyz),
    dot(camOffset, scene.cameraUp.xyz)
  ) / max(input.radius, 0.001);
  let radial = length(camLocal);
  let angle = atan2(camLocal.y, camLocal.x);
  let rings = 0.5 + 0.5 * sin(radial * 31.0 - time * 2.2 + angle * 2.0);
  let ringMask = pow(rings, 7.0);
  let swirl = 0.5 + 0.5 * sin(angle * 5.0 - radial * 18.0 + time * 1.15);
  let core = exp(-7.5 * radial * radial);

  let base = mix(scene.themeA.rgb, input.color.rgb, 0.90);
  let electric = mix(input.color.rgb * 1.12, vec3f(0.42, 0.86, 1.0), 0.24);
  var color = base * (0.30 + 0.74 * facing);
  color += electric * (fresnel * 1.08 + ringMask * 0.35 + core * 1.30);
  color += input.color.rgb * swirl * 0.18;

  let interactionGlow = max(clamp(input.metadata.y, 0.0, 1.0), clamp(input.metadata.z, 0.0, 1.0) * 0.65);
  color += vec3f(0.72, 0.94, 1.0) * interactionGlow * exp(-28.0 * abs(radial - 1.02));
  let glow = exp(-5.0 * max(radial - 0.72, 0.0)) * (1.0 - smoothstep(1.10, 1.42, radial));
  color += electric * glow * 0.34;
  let alpha = clamp(input.color.a + glow * 0.22 + interactionGlow * glow * 0.12, 0.0, 1.0);
  return vec4f(max(color, vec3f(0.0)), alpha);
}
