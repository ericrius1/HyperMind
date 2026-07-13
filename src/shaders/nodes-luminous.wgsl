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
  @location(2) metadata: vec4f,
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
  let extent = 1.42;
  let worldPosition = node.position.xyz
    + scene.cameraRight.xyz * corner.x * radius * extent
    + scene.cameraUp.xyz * corner.y * radius * extent;
  var output: VertexOutput;
  output.position = scene.viewProjection * vec4f(worldPosition, 1.0);
  output.local = corner * extent;
  output.color = node.color;
  output.metadata = node.metadata;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let radius = length(input.local);
  let animated = step(0.5, scene.render.x);
  let time = scene.timing.x * animated;
  let inside = 1.0 - smoothstep(0.985, 1.015, radius);
  let glow = exp(-5.0 * max(radius - 0.72, 0.0)) * (1.0 - smoothstep(1.10, 1.42, radius));
  if (max(inside, glow) < 0.002) {
    discard;
  }

  let z = sqrt(max(1.0 - radius * radius, 0.0));
  let fresnel = pow(1.0 - z, 2.7);
  let angle = atan2(input.local.y, input.local.x);
  let rings = 0.5 + 0.5 * sin(radius * 31.0 - time * 2.2 + angle * 2.0);
  let ringMask = pow(rings, 7.0) * inside;
  let swirl = 0.5 + 0.5 * sin(angle * 5.0 - radius * 18.0 + time * 1.15);
  let core = exp(-7.5 * radius * radius);

  let base = mix(scene.themeA.rgb, input.color.rgb, 0.72);
  let electric = mix(scene.themeB.rgb, vec3f(0.42, 0.86, 1.0), 0.45);
  var color = base * (0.30 + 0.74 * z);
  color += electric * (fresnel * 1.08 + ringMask * 0.35 + core * 1.30);
  color += input.color.rgb * swirl * 0.12 * inside;

  let interactionGlow = max(clamp(input.metadata.y, 0.0, 1.0), clamp(input.metadata.z, 0.0, 1.0) * 0.65);
  color += vec3f(0.72, 0.94, 1.0) * interactionGlow * exp(-28.0 * abs(radius - 1.02));
  color += electric * glow * 0.34;
  let alpha = clamp(inside * input.color.a + glow * 0.22 + interactionGlow * glow * 0.12, 0.0, 1.0);
  return vec4f(max(color, vec3f(0.0)), alpha);
}
