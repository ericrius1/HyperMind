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

struct SimUniforms {
  slot0: vec4f,
  slot1: vec4f,
  slot2: vec4f,
  slot3: vec4f,
};

// slot0: deltaTime, nodeCount, dimensions (2 or 3), layoutMode (0..3)
// slot1: repulsion, attraction, damping, centerStrength
// slot2: restLength, maxSpeed, boundaryRadius, elapsedTime
// slot3: edgeCount, clusterCount, layoutStrength, latticeSpacing
@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<storage, read> sourceNodes: array<Node>;
@group(0) @binding(2) var<storage, read_write> destinationNodes: array<Node>;
@group(0) @binding(3) var<storage, read> edges: array<Edge>;

fn hash11(value: f32) -> f32 {
  return fract(sin(value * 127.1 + 311.7) * 43758.5453);
}

fn safeNormalize(value: vec3f) -> vec3f {
  let magnitudeSquared = dot(value, value);
  if (magnitudeSquared < 0.000001) {
    return vec3f(0.0);
  }
  return value * inverseSqrt(magnitudeSquared);
}

fn radialTarget(index: u32, count: u32, dimensions: f32, radius: f32) -> vec3f {
  let fraction = f32(index) / max(f32(count), 1.0);
  let angle = fraction * 6.28318530718;
  if (dimensions < 2.5) {
    return vec3f(cos(angle) * radius, sin(angle) * radius, 0.0);
  }
  let y = 1.0 - 2.0 * (f32(index) + 0.5) / max(f32(count), 1.0);
  let ring = sqrt(max(1.0 - y * y, 0.0));
  let goldenAngle = f32(index) * 2.39996322973;
  return vec3f(cos(goldenAngle) * ring, y, sin(goldenAngle) * ring) * radius;
}

fn clusterTarget(node: Node, index: u32, dimensions: f32, clusterCount: u32, radius: f32) -> vec3f {
  let cluster = u32(abs(round(node.metadata.x))) % max(clusterCount, 1u);
  let angle = f32(cluster) / f32(max(clusterCount, 1u)) * 6.28318530718;
  var center = vec3f(cos(angle), sin(angle), 0.0) * radius * 0.58;
  if (dimensions >= 2.5) {
    center = vec3f(center.xy, (hash11(f32(cluster) + 4.7) - 0.5) * radius * 0.82);
  }
  let localAngle = f32(index) * 2.39996322973 + f32(cluster);
  var offset = vec3f(cos(localAngle), sin(localAngle), 0.0) * radius * (0.07 + 0.09 * hash11(f32(index)));
  if (dimensions >= 2.5) {
    offset = vec3f(offset.xy, (hash11(f32(index) + 9.2) - 0.5) * radius * 0.20);
  }
  return center + offset;
}

fn latticeTarget(index: u32, count: u32, dimensions: f32, spacing: f32) -> vec3f {
  if (dimensions < 2.5) {
    let width = max(u32(ceil(sqrt(max(f32(count), 1.0)))), 1u);
    let x = f32(index % width) - (f32(width) - 1.0) * 0.5;
    let y = f32(index / width) - (ceil(f32(count) / f32(width)) - 1.0) * 0.5;
    return vec3f(x * spacing, y * spacing, 0.0);
  }
  let side = max(u32(ceil(pow(max(f32(count), 1.0), 1.0 / 3.0))), 1u);
  let plane = side * side;
  let x = f32(index % side) - (f32(side) - 1.0) * 0.5;
  let y = f32((index / side) % side) - (f32(side) - 1.0) * 0.5;
  let z = f32(index / plane) - (ceil(f32(count) / f32(plane)) - 1.0) * 0.5;
  return vec3f(x, y, z) * spacing;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
  let index = globalId.x;
  let nodeCount = min(u32(max(sim.slot0.y, 0.0)), arrayLength(&sourceNodes));
  if (index >= nodeCount || index >= arrayLength(&destinationNodes)) {
    return;
  }

  var node = sourceNodes[index];
  // abs(metadata.w) pins the node. Negative pinning also removes its influence on peers.
  if (abs(node.metadata.w) >= 0.5) {
    node.velocity = vec4f(0.0, 0.0, 0.0, node.velocity.w);
    if (sim.slot0.z < 2.5) {
      node.position = vec4f(node.position.xy, 0.0, node.position.w);
    }
    destinationNodes[index] = node;
    return;
  }

  let dimensions = sim.slot0.z;
  let deltaTime = clamp(sim.slot0.x, 0.0, 0.0333333);
  let layoutMode = u32(clamp(round(sim.slot0.w), 0.0, 3.0));
  let restLength = max(sim.slot2.x, 0.01);
  var force = -node.position.xyz * sim.slot1.w;

  // The bounded O(n^2) path is intentional for the <=256 node interactive tier.
  for (var otherIndex = 0u; otherIndex < nodeCount; otherIndex += 1u) {
    if (otherIndex == index) {
      continue;
    }
    let other = sourceNodes[otherIndex];
    if (other.metadata.w <= -0.5) {
      continue;
    }
    var delta = node.position.xyz - other.position.xyz;
    if (dimensions < 2.5) {
      delta = vec3f(delta.xy, 0.0);
    }
    let distanceSquared = max(dot(delta, delta), 0.04);
    force += safeNormalize(delta) * (sim.slot1.x / distanceSquared);
  }

  let edgeCount = min(u32(max(sim.slot3.x, 0.0)), arrayLength(&edges));
  for (var edgeIndex = 0u; edgeIndex < edgeCount; edgeIndex += 1u) {
    let edge = edges[edgeIndex];
    var otherIndex = nodeCount;
    if (edge.endpoints.x == index) {
      otherIndex = edge.endpoints.y;
    } else if (edge.endpoints.y == index) {
      otherIndex = edge.endpoints.x;
    }
    if (otherIndex < nodeCount) {
      let otherNode = sourceNodes[otherIndex];
      if (otherNode.metadata.w <= -0.5) {
        continue;
      }
      var delta = otherNode.position.xyz - node.position.xyz;
      if (dimensions < 2.5) {
        delta = vec3f(delta.xy, 0.0);
      }
      let distance = max(length(delta), 0.0001);
      force += (delta / distance) * (distance - restLength) * sim.slot1.y * max(edge.style.y, 0.05);
    }
  }

  let layoutStrength = max(sim.slot3.z, 0.0);
  var layoutTarget = vec3f(0.0);
  if (layoutMode == 1u) {
    layoutTarget = radialTarget(index, nodeCount, dimensions, restLength * (1.6 + sqrt(f32(nodeCount)) * 0.08));
  } else if (layoutMode == 2u) {
    layoutTarget = clusterTarget(node, index, dimensions, max(u32(max(sim.slot3.y, 1.0)), 1u), restLength * 3.2);
  } else if (layoutMode == 3u) {
    layoutTarget = latticeTarget(index, nodeCount, dimensions, max(sim.slot3.w, restLength));
  }
  if (layoutMode != 0u) {
    force += (layoutTarget - node.position.xyz) * layoutStrength;
  }

  var velocity = node.velocity.xyz + force * deltaTime;
  velocity *= exp(-max(sim.slot1.z, 0.0) * deltaTime);
  let speed = length(velocity);
  let maxSpeed = max(sim.slot2.y, 0.01);
  if (speed > maxSpeed) {
    velocity *= maxSpeed / speed;
  }

  var position = node.position.xyz + velocity * deltaTime;
  if (dimensions < 2.5) {
    position = vec3f(position.xy, 0.0);
    velocity = vec3f(velocity.xy, 0.0);
  }
  let boundaryRadius = max(sim.slot2.z, 0.0);
  let distanceFromOrigin = length(position);
  if (boundaryRadius > 0.0 && distanceFromOrigin > boundaryRadius) {
    let normal = position / max(distanceFromOrigin, 0.0001);
    position = normal * boundaryRadius;
    velocity -= normal * max(dot(velocity, normal), 0.0) * 1.35;
  }

  node.position = vec4f(position, node.position.w);
  node.velocity = vec4f(velocity, node.velocity.w);
  destinationNodes[index] = node;
}
