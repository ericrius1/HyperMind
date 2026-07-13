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
  @location(2) @interpolate(flat) index: u32,
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
  let markerRadius = max(node.position.w * scene.render.z * 1.26, 0.035);
  let worldPosition = node.position.xyz
    + scene.cameraRight.xyz * corner.x * markerRadius
    + scene.cameraUp.xyz * corner.y * markerRadius;
  var output: VertexOutput;
  output.position = scene.viewProjection * vec4f(worldPosition, 1.0);
  output.local = corner;
  output.color = node.color;
  output.index = instanceIndex;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let radius = length(input.local);
  let aa = max(fwidth(radius), 0.002);
  let ring = smoothstep(0.70 - aa, 0.70 + aa, radius)
    * (1.0 - smoothstep(0.82 - aa, 0.82 + aa, radius));
  let crossX = 1.0 - smoothstep(0.035, 0.075, abs(input.local.x));
  let crossY = 1.0 - smoothstep(0.035, 0.075, abs(input.local.y));
  let cross = max(crossX, crossY) * (1.0 - smoothstep(0.48, 0.60, radius));
  let tickPhase = f32(input.index % 7u) / 7.0;
  let pulse = 0.78 + 0.22 * sin(scene.timing.x * 2.0 + tickPhase * 6.28318530718);
  let alpha = max(ring, cross) * pulse;
  if (alpha < 0.002) {
    discard;
  }
  let color = mix(vec3f(0.20, 0.92, 1.0), input.color.rgb, 0.32);
  return vec4f(color, alpha * 0.92);
}
