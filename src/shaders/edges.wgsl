struct Node {
  position: vec4f,
  velocity: vec4f,
  color: vec4f,
  metadata: vec4f,
};

struct Edge {
  endpoints: vec4u,
  style: vec4f,
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
@group(0) @binding(2) var<storage, read> edges: array<Edge>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) lineUV: vec2f,
  @location(1) color: vec4f,
  @location(2) style: vec4f,
};

fn quadVertex(index: u32) -> vec2f {
  let vertices = array<vec2f, 6>(
    vec2f(0.0, -1.0), vec2f(1.0, -1.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  return vertices[index];
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let edge = edges[instanceIndex];
  let nodeA = nodes[edge.endpoints.x];
  let nodeB = nodes[edge.endpoints.y];
  let clipA = scene.viewProjection * vec4f(nodeA.position.xyz, 1.0);
  let clipB = scene.viewProjection * vec4f(nodeB.position.xyz, 1.0);
  let safeWA = select(clipA.w, 0.00001, abs(clipA.w) < 0.00001);
  let safeWB = select(clipB.w, 0.00001, abs(clipB.w) < 0.00001);
  let ndcA = clipA.xy / safeWA;
  let ndcB = clipB.xy / safeWB;
  let pixelDirection = (ndcB - ndcA) * 0.5 * scene.viewport.xy;
  let lineLength = max(length(pixelDirection), 0.0001);
  let normalPixels = vec2f(-pixelDirection.y, pixelDirection.x) / lineLength;
  let thickness = max(edge.style.x, 0.5);
  let offsetNdc = normalPixels * thickness * 2.0 / max(scene.viewport.xy, vec2f(1.0));

  let corner = quadVertex(vertexIndex);
  let along = corner.x;
  let baseClip = mix(clipA, clipB, along);
  var output: VertexOutput;
  output.position = vec4f(baseClip.xy + offsetNdc * corner.y * baseClip.w, baseClip.zw);
  output.lineUV = vec2f(along * lineLength, corner.y);
  output.color = mix(nodeA.color, nodeB.color, along);
  output.style = edge.style;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let edgeAA = max(fwidth(input.lineUV.y), 0.015);
  let coverage = 1.0 - smoothstep(1.0 - edgeAA, 1.0, abs(input.lineUV.y));
  let dashFrequency = max(input.style.z, 0.0);
  var dash = 1.0;
  if (dashFrequency > 0.001) {
    let phase = input.lineUV.x * dashFrequency * 0.035 - scene.timing.x * input.style.w;
    dash = smoothstep(0.16, 0.30, sin(phase) * 0.5 + 0.5);
  }
  let pulse = 0.78 + 0.22 * sin(scene.timing.x * 1.7 + input.lineUV.x * 0.018 + input.style.w);
  let themeColor = mix(scene.themeA.rgb, scene.themeB.rgb, 0.72);
  let color = mix(themeColor, input.color.rgb, 0.68) * pulse;
  let alpha = coverage * dash * clamp(input.style.y, 0.0, 1.0) * input.color.a;
  if (alpha < 0.002) {
    discard;
  }
  return vec4f(color, alpha);
}
