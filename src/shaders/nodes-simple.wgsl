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
  let worldPosition = node.position.xyz
    + scene.cameraRight.xyz * corner.x * radius * 1.08
    + scene.cameraUp.xyz * corner.y * radius * 1.08;
  var output: VertexOutput;
  output.position = scene.viewProjection * vec4f(worldPosition, 1.0);
  output.local = corner * 1.08;
  output.color = node.color;
  output.metadata = node.metadata;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let radius = length(input.local);
  let aa = max(fwidth(radius), 0.0015);
  let coverage = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, radius);
  if (coverage < 0.002) {
    discard;
  }

  let z = sqrt(max(1.0 - dot(input.local, input.local), 0.0));
  let normal = normalize(vec3f(input.local, z));
  let diffuse = max(dot(normal, normalize(vec3f(-0.42, 0.55, 0.86))), 0.0);
  let rim = pow(1.0 - z, 2.2);
  let base = mix(scene.themeA.rgb, input.color.rgb, 0.78);
  var color = base * (0.54 + 0.46 * diffuse);
  color += scene.themeB.rgb * rim * 0.16;
  color += vec3f(1.0) * pow(diffuse, 12.0) * 0.13;

  let selected = clamp(input.metadata.y, 0.0, 1.0);
  let hovered = clamp(input.metadata.z, 0.0, 1.0);
  let selectionRing = smoothstep(0.76, 0.83, radius) * (1.0 - smoothstep(0.88, 0.96, radius));
  color += mix(scene.themeB.rgb, vec3f(1.0), 0.35) * selectionRing * max(selected, hovered * 0.58);
  return vec4f(max(color, vec3f(0.0)), coverage * input.color.a);
}
