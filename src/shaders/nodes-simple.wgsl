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

// Unit sphere → rounded cube (L∞ projection), then mix for a sphere-cube hybrid.
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
  let worldOffset = shaped * radius * scale;
  let worldPosition = node.position.xyz + worldOffset;
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
  let lightDir = normalize(vec3f(-0.42, 0.55, 0.86));
  let diffuse = max(dot(normal, lightDir), 0.0);
  let rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.2);
  let base = mix(scene.themeA.rgb, input.color.rgb, 0.92);
  var color = base * (0.54 + 0.46 * diffuse);
  color += input.color.rgb * rim * 0.22;
  color += vec3f(1.0) * pow(diffuse, 12.0) * 0.13;

  let camOffset = input.worldPosition - input.worldCenter;
  let camLocal = vec2f(
    dot(camOffset, scene.cameraRight.xyz),
    dot(camOffset, scene.cameraUp.xyz)
  ) / max(input.radius, 0.001);
  let radial = length(camLocal);
  let selected = clamp(input.metadata.y, 0.0, 1.0);
  let hovered = clamp(input.metadata.z, 0.0, 1.0);
  let selectionRing = smoothstep(0.76, 0.83, radial) * (1.0 - smoothstep(0.88, 0.96, radial));
  color += mix(scene.themeB.rgb, vec3f(1.0), 0.35) * selectionRing * max(selected, hovered * 0.58);
  return vec4f(max(color, vec3f(0.0)), input.color.a);
}
