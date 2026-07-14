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
  @location(0) @interpolate(linear) lineCoord: vec2f,
  @location(1) @interpolate(flat) colorA: vec4f,
  @location(2) @interpolate(flat) colorB: vec4f,
  @location(3) @interpolate(flat) style: vec4f,
  @location(4) @interpolate(flat) shape: vec4f,
  @location(5) @interpolate(flat) gradientRange: vec2f,
};

fn quadVertex(index: u32) -> vec2f {
  let vertices = array<vec2f, 6>(
    vec2f(0.0, -1.0), vec2f(1.0, -1.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  return vertices[index];
}

fn hiddenVertex() -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(2.0, 2.0, 0.0, 1.0);
  output.lineCoord = vec2f(0.0);
  output.colorA = vec4f(0.0);
  output.colorB = vec4f(0.0);
  output.style = vec4f(0.0);
  output.shape = vec4f(0.0);
  output.gradientRange = vec2f(0.0);
  return output;
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let edge = edges[instanceIndex];
  let nodeA = nodes[edge.endpoints.x];
  let nodeB = nodes[edge.endpoints.y];
  let originalA = scene.viewProjection * vec4f(nodeA.position.xyz, 1.0);
  let originalB = scene.viewProjection * vec4f(nodeB.position.xyz, 1.0);

  // Clip against WebGPU's near plane before perspective division.
  if (originalA.z < 0.0 && originalB.z < 0.0) {
    return hiddenVertex();
  }
  var clipA = originalA;
  var clipB = originalB;
  var gradientStart = 0.0;
  var gradientEnd = 1.0;
  let denominator = originalA.z - originalB.z;
  if (originalA.z < 0.0) {
    let clipped = clamp(originalA.z / denominator, 0.0, 1.0);
    clipA = mix(originalA, originalB, clipped);
    gradientStart = clipped;
  } else if (originalB.z < 0.0) {
    let clipped = clamp(originalA.z / denominator, 0.0, 1.0);
    clipB = mix(originalA, originalB, clipped);
    gradientEnd = clipped;
  }

  let safeWA = max(clipA.w, 0.00001);
  let safeWB = max(clipB.w, 0.00001);
  let ndcA = clipA.xy / safeWA;
  let ndcB = clipB.xy / safeWB;
  let pixelDirection = (ndcB - ndcA) * 0.5 * scene.viewport.xy;
  let lineLength = length(pixelDirection);
  let tangent = select(pixelDirection / max(lineLength, 0.0001), vec2f(1.0, 0.0), lineLength < 0.0001);
  let normal = vec2f(-tangent.y, tangent.x);
  let crossRegion = f32(edge.endpoints.z & 1u);
  let halfWidthPixels = max(edge.style.x * max(scene.viewport.w, 0.25), 0.5);
  let aaFringe = max(0.85, 0.48 * scene.viewport.w);
  let outerHalfWidth = halfWidthPixels + aaFringe;

  let corner = quadVertex(vertexIndex);
  let alongPixels = mix(-outerHalfWidth, lineLength + outerHalfWidth, corner.x);
  let axisPixels = clamp(alongPixels, 0.0, lineLength);
  let visibleProgress = select(axisPixels / max(lineLength, 0.0001), 0.5, lineLength < 0.0001);
  let baseClip = mix(clipA, clipB, visibleProgress);
  let extensionPixels = alongPixels - axisPixels;
  let offsetPixels = tangent * extensionPixels + normal * corner.y * outerHalfWidth;
  let offsetNdc = offsetPixels * 2.0 / max(scene.viewport.xy, vec2f(1.0));

  var output: VertexOutput;
  output.position = vec4f(baseClip.xy + offsetNdc * baseClip.w, baseClip.zw);
  output.lineCoord = vec2f(alongPixels, corner.y * outerHalfWidth);
  output.colorA = nodeA.color;
  output.colorB = nodeB.color;
  output.style = edge.style;
  output.shape = vec4f(lineLength, halfWidthPixels, crossRegion, aaFringe);
  output.gradientRange = vec2f(gradientStart, gradientEnd);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let lineLength = input.shape.x;
  let halfWidth = input.shape.y;
  let crossRegion = input.shape.z;
  let nearestAlong = clamp(input.lineCoord.x, 0.0, lineLength);
  let distanceFromAxis = length(vec2f(input.lineCoord.x - nearestAlong, input.lineCoord.y));
  let signedDistance = distanceFromAxis - halfWidth;
  let aa = max(fwidth(signedDistance), 0.72);
  let coverage = 1.0 - smoothstep(-aa, aa, signedDistance);
  if (coverage < 0.002) {
    discard;
  }

  let visibleProgress = select(nearestAlong / max(lineLength, 0.0001), 0.5, lineLength < 0.0001);
  let gradientProgress = mix(input.gradientRange.x, input.gradientRange.y, visibleProgress);
  let regionColor = mix(input.colorA.rgb, input.colorB.rgb, gradientProgress);
  let center = 1.0 - smoothstep(0.05, 0.72, abs(input.lineCoord.y) / max(halfWidth, 0.001));
  let animated = step(0.5, scene.render.x);
  let pulse = mix(1.0, 0.97 + 0.03 * sin(scene.timing.x * 1.35 + input.lineCoord.x * 0.012 + input.style.w), animated);
  var color = regionColor * pulse;
  color += mix(scene.themeB.rgb, vec3f(1.0), 0.42) * center * crossRegion * 0.075;

  let masterOpacity = clamp(scene.themeB.a * 1.8, 0.0, 1.0);
  let emphasis = mix(0.84, 1.12, crossRegion);
  let alpha = clamp(coverage * input.style.y * masterOpacity * emphasis * mix(input.colorA.a, input.colorB.a, gradientProgress), 0.0, 1.0);
  if (alpha < 0.002) {
    discard;
  }
  return vec4f(max(color, vec3f(0.0)), alpha);
}
