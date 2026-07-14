# HyperMind

<video src="./docs/hypermind-demo.mp4" width="100%" controls muted autoplay loop playsinline></video>

HyperMind is a raw-WebGPU spatial canvas for connected ideas. It combines an infinite 2D graph, a navigable 3D view, immediate HTML editing, GPU force layouts, three hot-reloadable shader skins, and a Box3D-powered physics playground.

It ships with five editable atlases. The reinforcement-learning atlas is the default:

- **Reinforcement Learning for Evolving Agents** — RL foundations, practical algorithms, multi-agent learning, genetic algorithms, neuroevolution, and a concrete training architecture for persistent agents in the San Francisco open world.

- **Tutorial Atlas** — systems, making, mind, technology, and the living world.
- **Kabbalah: Worlds, Texts, and Repair** — Jewish mystical traditions, sefirot, texts, Safed, Lurianic teaching, and religious life.
- **Francis of Assisi** — conversion, the Canticle of the Creatures, the Wolf of Gubbio tradition, Damietta, pilgrimage, and the Franciscan family.
- **Sacred Roads** — Camino routes, signs, hospitality, monastic lineages, mendicant orders, and pilgrimage destinations.

Scene edits persist locally (no account) in a SQLite database backed by the Origin Private File System when available, with an IndexedDB fallback. Built-in portal nodes connect Francis, the Camino, the Canticle, and religious-order subclusters. Use **Atlas → Export / Import** to move `.hypermind` files between browsers, machines, and the desktop app.

## Run it

### Web

```bash
npm install
npm run dev
```

Chrome or another current WebGPU browser is required. The app deliberately fails with a clear message when WebGPU is unavailable; it does not silently replace the renderer with Canvas or WebGL.

The Vite server sends COOP/COEP headers so SQLite can use OPFS. Production static hosts need the same headers:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

```bash
npm run build:web
npm run preview
```

### Desktop (Electron)

Same renderer as the web build, packaged in Chromium so WebGPU matches Chrome:

```bash
npm run dev:desktop
```

Create installers:

```bash
npm run build:desktop
```

Artifacts land in `release/` (macOS DMG/zip, Windows NSIS, Linux AppImage).

## Local save and transfer

- Edits auto-save into the local SQLite/OPFS (or IndexedDB) store. No sign-in.
- Legacy `localStorage` atlases migrate once on first open.
- **Atlas → Export this world** / **Export all worlds** writes a portable `.hypermind` JSON file.
- **Atlas → Import .hypermind** replaces matching world ids and keeps everything else.
- Copy the file to another device (AirDrop, drive, chat) and import there — web or desktop.

## Controls

- Drag empty space to pan in 2D or orbit in 3D. Shift-drag pans in 3D.
- Scroll to zoom or dolly. Zooming in 2D stays centered beneath the pointer.
- Click a node to peek its title and one-line blurb beside it. Double-click or Space opens the discovery modal for the selection. Shift-click builds a selection.
- Use the **WORLDS** selector to switch topics. The bottom navigator frames individual subclusters.
- **Atlas** exports or imports a `.hypermind` file for backup and cross-device transfer.
- **Share view** copies the current topic or subcluster link. Every discovery modal also has **Copy discovery link**.
- Shared URLs use `?scene=…&focus=node:…` or `?scene=…&focus=subcluster:…`; opening one restores the graph, selection, and camera scale.
- Drag selected nodes. The **Dragged nodes influence graph** setting switches between connected and isolated dragging.
- Double-click empty canvas or use **Plant a discovery** to create a node. Use **Open a trail** and click a target to connect ideas.
- Close the discovery modal with the ×, **Return to the overmap**, click outside, or `Esc`.
- **Play physics** or `F` toggles Box3D play mode. Choose zero-g tethers, lunar drop, or elastic web.
- `C` toggles 2D/3D. `1`, `2`, `3` choose Paperlight, Luminous, or Midnight Core rendering.
- `/` toggles diagnostics, `m` toggles landmark overlays, and `.` restores the current source defaults.
- In 3D fly mode, use WASD, Space, and Shift.

## Architecture

Durable graph content lives on the CPU and is persisted through a small portable backend (`src/data/persistence`): SQLite WASM in a worker with OPFS when available. Live simulation transforms live in aligned, ping-ponged WebGPU storage buffers. The web app and Electron shell share the same Vite renderer; Electron only hosts Chromium and does not own GPU or database code.

The frame graph is:

1. GPU force/layout compute (or Box3D WASM transforms in physics mode)
2. Procedural infinite-canvas background
3. Instanced anti-aliased link capsules, with thicker endpoint-color gradients across regions
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

The default tier is tuned for a high-refresh Apple-silicon laptop: instanced impostors, one submission per rendered frame, bounded 256-node interactive compute, no full-buffer hot-path readbacks, capped DPR, fixed WGSL layouts, and a strict 40-step ceiling in the dream skin. Tweakpane exposes resolution, ray-step, physics, density, and effect controls so the frame budget can be profiled rather than assumed.
