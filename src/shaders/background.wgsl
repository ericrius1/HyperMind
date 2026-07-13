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

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  let p = positions[vertexIndex];
  var output: VertexOutput;
  output.position = vec4f(p, 0.9999, 1.0);
  output.uv = p * 0.5 + 0.5;
  return output;
}

fn hash21(p: vec2f) -> f32 {
  let q = fract(p * vec2f(123.34, 456.21));
  return fract(q.x * q.y * (q.x + q.y + 45.32));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let aspect = scene.viewport.x / max(scene.viewport.y, 1.0);
  let centered = (input.uv - 0.5) * vec2f(aspect, 1.0);
  let distanceFromCenter = length(centered);
  let animated = step(0.5, scene.render.x);
  let time = scene.timing.x * animated;

  var color = mix(scene.themeA.rgb, scene.themeB.rgb, 0.20 + 0.52 * input.uv.y);
  let vignette = 1.0 - smoothstep(0.22, 1.04, distanceFromCenter);
  color *= 0.38 + 0.62 * vignette;

  let scale = max(scene.viewport.z, 0.0001);
  let pan = scene.cameraPosition.xy * (0.020 * scale);
  let gridSpace = centered * (15.0 / scale) + pan;
  let cell = abs(fract(gridSpace + 0.5) - 0.5) / max(fwidth(gridSpace), vec2f(0.0001));
  let minorLine = 1.0 - min(min(cell.x, cell.y), 1.0);
  let majorSpace = gridSpace * 0.2;
  let majorCell = abs(fract(majorSpace + 0.5) - 0.5) / max(fwidth(majorSpace), vec2f(0.0001));
  let majorLine = 1.0 - min(min(majorCell.x, majorCell.y), 1.0);
  color += scene.themeB.rgb * (minorLine * 0.025 + majorLine * 0.055) * (0.4 + 0.6 * vignette);

  let glowCenter = vec2f(-0.16 + sin(time * 0.071) * 0.08, 0.08 + cos(time * 0.053) * 0.06);
  let glow = exp(-5.0 * length(centered - glowCenter));
  color += mix(scene.themeA.rgb, scene.themeB.rgb, 0.72) * glow * 0.18;

  // Midnight is an emissive skin; a restrained navy field preserves blue highlight range.
  let midnight = step(0.5, scene.timing.w);
  color = mix(color, color * 0.24 + vec3f(0.0015, 0.004, 0.016), midnight);

  let pixel = floor(input.position.xy * 0.5);
  let grain = hash21(pixel + floor(time * 12.0)) - 0.5;
  color += grain * 0.012;
  return vec4f(max(color, vec3f(0.0)), 1.0);
}
