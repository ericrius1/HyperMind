# HyperMind

HyperMind is a raw-WebGPU spatial canvas for connected ideas. It combines an infinite 2D graph, a navigable 3D view, immediate HTML editing, GPU force layouts, three hot-reloadable shader skins, and a Box3D-powered physics playground.

It ships with four editable atlases:

- **Tutorial Atlas** — systems, making, mind, technology, and the living world.
- **Kabbalah: Worlds, Texts, and Repair** — Jewish mystical traditions, sefirot, texts, Safed, Lurianic teaching, and religious life.
- **Francis of Assisi** — conversion, the Canticle of the Creatures, the Wolf of Gubbio tradition, Damietta, pilgrimage, and the Franciscan family.
- **Sacred Roads** — Camino routes, signs, hospitality, monastic lineages, mendicant orders, and pilgrimage destinations.

Scene edits persist independently in the browser. Built-in portal nodes connect Francis, the Camino, the Canticle, and religious-order subclusters.

## Run it

```bash
npm install
npm run dev
```

Chrome or another current WebGPU browser is required. The app deliberately fails with a clear message when WebGPU is unavailable; it does not silently replace the renderer with Canvas or WebGL.

## Controls

- Drag empty space to pan in 2D or orbit in 3D. Shift-drag pans in 3D.
- Scroll to zoom or dolly. Zooming in 2D stays centered beneath the pointer.
- Click a node to open its immediately editable card. Shift-click builds a selection.
- Use the **Atlas** selector to switch topics. The bottom navigator frames individual subclusters.
- **Share view** copies the current topic or subcluster link. Every node card also has **Copy node link**.
- Shared URLs use `?scene=…&focus=node:…` or `?scene=…&focus=subcluster:…`; opening one restores the graph, selection, inspector, and camera scale.
- Drag selected nodes. The **Dragged nodes influence graph** setting switches between connected and isolated dragging.
- Double-click the canvas or use **New thought** to create a node. Use **Link from this** and click a target to connect ideas.
- **Play physics** or `F` toggles Box3D play mode. Choose zero-g tethers, lunar drop, or elastic web.
- `1`, `2`, `3` choose Paperlight, Luminous, or Midnight Core rendering.
- `/` toggles diagnostics, `m` toggles landmark overlays, and `.` restores the current source defaults.
- In 3D fly mode, use WASD, Space, and Shift.

## Architecture

Durable graph content lives on the CPU. Live simulation transforms live in aligned, ping-ponged WebGPU storage buffers. The frame graph is:

1. GPU force/layout compute (or Box3D WASM transforms in physics mode)
2. Procedural infinite-canvas background
3. Instanced anti-aliased link ribbons
4. Instanced sphere impostors using the selected skin
5. Optional landmark diagnostics
6. Bounded compute picking with a four-byte asynchronous readback

Node records are 64 bytes (`position`, `velocity`, `color`, `metadata`, each a `vec4f`) and edge records are 32 bytes. The single ABI works in both dimensions; 2D constrains `z` instead of introducing a separate solver.

The three render tiers share graph resources but own separate WGSL modules:

- **Paperlight** — analytic lit sphere impostors.
- **Luminous** — Fresnel, procedural rings, soft aura, and depth.
- **Midnight Core** — bounded 8–24 step adaptive volumetric impostors with stable blue filaments, a hot emissive core, highlight compression, and a separate depthless aura.

Five palettes recolor the same cluster metadata without changing pipelines. Shader modules, CSS, palettes, node content, and UI modules use Vite HMR. Changing the shared GPU ABI is intentionally a full app restore boundary.

## Physics

`box3d.js/inline` initializes Erin Catto's Box3D WebAssembly build without a separate asset request. Each node becomes a sphere body. In physics play, graph edges become native Box3D distance joints:

- **Zero-g tethers** use soft springs and cable limits.
- **Lunar drop** uses lunar gravity, higher restitution, and weaker links.
- **Elastic web** uses stiff, strongly damped spring joints.

The ordinary data layout remains GPU-native by default. Tweakpane can switch data mode to Box3D as well.

## Performance intent

The default tier is tuned for a high-refresh Apple-silicon laptop: instanced impostors, one submission per rendered frame, bounded 256-node interactive compute, no full-buffer hot-path readbacks, capped DPR, fixed WGSL layouts, and a strict 24-step ceiling in the dream skin. Tweakpane exposes resolution, ray-step, physics, density, and effect controls so the frame budget can be profiled rather than assumed.
