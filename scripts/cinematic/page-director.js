(() => {
  'use strict';

  const BASE_FRAME_COUNT = 600;
  const TARGET_TITLE = 'Multi-Agent Markov Games';
  const NEW_TAG = 'persistent worlds';
  const BASE_PROBE_FRAMES = [
    0, 54, 107,
    108, 156, 209,
    210, 228, 246, 263, 284,
    285, 320, 337, 370, 389,
    390, 420, 452, 515,
    516, 558, 599,
  ];

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const lerp = (from, to, t) => from + (to - from) * t;
  const mix3 = (from, to, t) => [
    lerp(from[0], to[0], t),
    lerp(from[1], to[1], t),
    lerp(from[2], to[2], t),
  ];
  const smooth = (value) => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };
  const smoother = (value) => {
    const t = clamp(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const easeOut = (value) => 1 - Math.pow(1 - clamp(value), 3);
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  const state = {
    prepared: false,
    lastFrame: -1,
    shot: -1,
    config: null,
    app: null,
    targetIndex: -1,
    targetNode: null,
    targetPosition: [0, 0, 0],
    positions: [],
    bounds: null,
    wideZoom: 18,
    shotStartCamera: null,
    typedCommitted: false,
    saved: false,
    physicsStarted: false,
    heroStarted: false,
    lastPhysicsPositions: null,
    heroPosition: null,
    probeFrames: [],
  };

  function requireFunction(owner, key, path) {
    if (!owner || typeof owner[key] !== 'function') {
      throw new Error(`Cinematic capture requires ${path}()`);
    }
  }

  function requireValue(owner, key, path) {
    if (!owner || owner[key] === undefined || owner[key] === null) {
      throw new Error(`Cinematic capture requires ${path}`);
    }
  }

  function validateApp(app) {
    requireValue(app, 'frameHandle', 'app.frameHandle');
    requireValue(app, 'settings', 'app.settings');
    requireValue(app.settings, 'values', 'app.settings.values');
    requireFunction(app, 'applySettingsChange', 'app.applySettingsChange');
    requireValue(app, 'ui', 'app.ui');
    requireValue(app.ui, 'canvas', 'app.ui.canvas');
    requireFunction(app.ui, 'setDimension', 'app.ui.setDimension');
    requireFunction(app.ui, 'setSkin', 'app.ui.setSkin');
    requireFunction(app.ui, 'setPhysics', 'app.ui.setPhysics');
    requireFunction(app.ui, 'setSelectedLabel', 'app.ui.setSelectedLabel');
    requireFunction(app.ui, 'setRuntimeStatus', 'app.ui.setRuntimeStatus');
    requireValue(app, 'graph', 'app.graph');
    requireValue(app.graph, 'nodes', 'app.graph.nodes');
    requireFunction(app.graph, 'indexOf', 'app.graph.indexOf');
    requireFunction(app.graph, 'get', 'app.graph.get');
    requireValue(app, 'camera', 'app.camera');
    requireFunction(app.camera, 'frame', 'app.camera.frame');
    requireFunction(app.camera, 'setDimension', 'app.camera.setDimension');
    requireFunction(app.camera, 'setTransitioning', 'app.camera.setTransitioning');
    requireFunction(app.camera, 'distanceForZoom', 'app.camera.distanceForZoom');
    requireValue(app, 'buffers', 'app.buffers');
    requireFunction(app.buffers, 'readNodes', 'app.buffers.readNodes');
    requireFunction(app.buffers, 'writePositions', 'app.buffers.writePositions');
    requireValue(app, 'renderer', 'app.renderer');
    requireFunction(app.renderer, 'render', 'app.renderer.render');
    requireValue(app, 'gpu', 'app.gpu');
    requireFunction(app.gpu, 'resize', 'app.gpu.resize');
    requireValue(app.gpu, 'device', 'app.gpu.device');
    requireValue(app.gpu.device, 'queue', 'app.gpu.device.queue');
    requireFunction(app.gpu.device.queue, 'onSubmittedWorkDone', 'app.gpu.device.queue.onSubmittedWorkDone');
    requireValue(app, 'physics', 'app.physics');
    requireFunction(app.physics, 'initialize', 'app.physics.initialize');
    requireFunction(app.physics, 'step', 'app.physics.step');
    requireFunction(app.physics, 'getPositions', 'app.physics.getPositions');
    requireFunction(app.physics, 'setDimension', 'app.physics.setDimension');
    requireFunction(app, 'selectOnly', 'app.selectOnly');
    requireFunction(app, 'openInspector', 'app.openInspector');
    requireFunction(app, 'closeInspector', 'app.closeInspector');
    requireFunction(app, 'saveNode', 'app.saveNode');
    requireFunction(app, 'setFunPhysics', 'app.setFunPhysics');
    requireFunction(app, 'updateSelectedOverlay', 'app.updateSelectedOverlay');
  }

  function installCaptureCSS() {
    document.documentElement.classList.add('cinematic-capture');
    const style = document.createElement('style');
    style.id = 'hypermind-cinematic-capture-style';
    style.textContent = `
      .cinematic-capture *,
      .cinematic-capture *::before,
      .cinematic-capture *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      .cinematic-capture .ambient-grain,
      .cinematic-capture .diagnostics,
      .cinematic-capture .debug-fps {
        display: none !important;
      }
      .cinematic-capture .loading-screen {
        display: none !important;
      }
      .cinematic-capture #hypermind-capture-proxy {
        position: absolute !important;
        inset: 0 !important;
        z-index: 0 !important;
        display: none !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: fill !important;
        pointer-events: none !important;
      }
      .cinematic-capture.cinematic-layer-canvas .app-shell > :not(#graph-canvas):not(#hypermind-capture-proxy) {
        visibility: hidden !important;
      }
      .cinematic-capture.cinematic-layer-composite #graph-canvas {
        visibility: hidden !important;
      }
      .cinematic-capture.cinematic-layer-composite #hypermind-capture-proxy {
        display: block !important;
      }
      .cinematic-capture .inspector {
        top: 50% !important;
        right: 64px !important;
        bottom: auto !important;
        left: auto !important;
        width: min(700px, calc(100vw - 860px)) !important;
        max-height: calc(100vh - 150px) !important;
      }
      .cinematic-capture .inspector-backdrop {
        background: linear-gradient(90deg, rgba(2, 8, 18, .08), rgba(2, 8, 18, .64)) !important;
      }
      .cinematic-capture .save-node[data-cinematic-pressed="true"] {
        border-color: color-mix(in srgb, var(--accent) 72%, white) !important;
        background: color-mix(in srgb, var(--accent) 28%, rgba(255, 255, 255, .06)) !important;
        box-shadow: 0 0 30px color-mix(in srgb, var(--accent) 28%, transparent) !important;
        transform: scale(.985) !important;
      }
    `;
    document.head.append(style);
  }

  function captureProxy() {
    let proxy = document.querySelector('#hypermind-capture-proxy');
    if (proxy instanceof HTMLImageElement) return proxy;
    proxy = document.createElement('img');
    proxy.id = 'hypermind-capture-proxy';
    proxy.alt = '';
    proxy.setAttribute('aria-hidden', 'true');
    document.querySelector('.app-shell')?.append(proxy);
    return proxy;
  }

  async function setCaptureLayer(mode, dataUrl = '') {
    const root = document.documentElement;
    const proxy = captureProxy();
    root.classList.remove('cinematic-layer-canvas', 'cinematic-layer-composite');
    if (mode === 'canvas') {
      proxy.removeAttribute('src');
      root.classList.add('cinematic-layer-canvas');
    } else if (mode === 'composite') {
      if (!dataUrl.startsWith('data:image/png;base64,')) {
        throw new Error('Composite capture requires a PNG data URL');
      }
      proxy.src = dataUrl;
      await proxy.decode();
      root.classList.add('cinematic-layer-composite');
    } else if (mode === 'live') {
      proxy.removeAttribute('src');
    } else {
      throw new Error(`Unknown capture layer: ${String(mode)}`);
    }
    await nextFrame();
    await nextFrame();
    return mode;
  }

  function currentCamera() {
    const camera = state.app.camera;
    return {
      center: [...camera.center],
      zoom: camera.zoom,
      distance: camera.distance,
      yaw: camera.yaw,
      pitch: camera.pitch,
    };
  }

  function setCamera({ center, zoom, distance, yaw, pitch }) {
    const camera = state.app.camera;
    if (center) {
      camera.center = [...center];
      camera.targetCenter = [...center];
    }
    if (Number.isFinite(zoom)) {
      camera.zoom = zoom;
      camera.targetZoom = zoom;
    }
    if (Number.isFinite(distance)) {
      camera.distance = distance;
      camera.targetDistance = distance;
    }
    if (Number.isFinite(yaw)) {
      camera.yaw = yaw;
      camera.targetYaw = yaw;
    }
    if (Number.isFinite(pitch)) {
      camera.pitch = pitch;
      camera.targetPitch = pitch;
    }
    camera.setTransitioning(false);
  }

  function boundsFor(positions) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (const position of positions) {
      minX = Math.min(minX, position[0]);
      minY = Math.min(minY, position[1]);
      minZ = Math.min(minZ, position[2]);
      maxX = Math.max(maxX, position[0]);
      maxY = Math.max(maxY, position[1]);
      maxZ = Math.max(maxZ, position[2]);
    }
    return {
      center: [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5],
      size: [Math.max(1, maxX - minX), Math.max(1, maxY - minY), Math.max(1, maxZ - minZ)],
    };
  }

  function scaledFrame(baseFrame) {
    const frames = state.config.frames;
    return Math.min(frames - 1, Math.max(0, Math.round(baseFrame * (frames - 1) / (BASE_FRAME_COUNT - 1))));
  }

  function shotDefinition(frame) {
    const cuts = [0, 108, 210, 285, 390, 516, BASE_FRAME_COUNT].map(scaledFrame);
    cuts[cuts.length - 1] = state.config.frames;
    const names = ['wide-2d-rl', 'markov-closeup', 'inspector-tag-save', 'gpu-2d-to-3d', 'zero-g-orbit', 'hero-resolve'];
    let index = names.length - 1;
    for (let candidate = 0; candidate < names.length; candidate += 1) {
      if (frame >= cuts[candidate] && frame < cuts[candidate + 1]) {
        index = candidate;
        break;
      }
    }
    const start = cuts[index];
    const end = cuts[index + 1];
    const progress = end - start <= 1 ? 1 : (frame - start) / (end - start - 1);
    return { index, name: names[index], start, end, local: frame - start, progress: clamp(progress) };
  }

  function toast(message, active) {
    const element = document.querySelector('.toast');
    if (!element) return;
    if (message) element.textContent = message;
    element.classList.toggle('is-visible', active);
  }

  function hideInspectorInlineStyles() {
    const inspector = document.querySelector('.inspector');
    const backdrop = document.querySelector('.inspector-backdrop');
    if (inspector) {
      inspector.style.removeProperty('opacity');
      inspector.style.removeProperty('transform');
    }
    if (backdrop) backdrop.style.removeProperty('opacity');
  }

  async function enterShot(shot) {
    const app = state.app;
    state.shotStartCamera = currentCamera();

    if (shot.index === 0) {
      app.settings.values.dimension = '2d';
      app.camera.dimension = '2d';
      app.dimensionBlend = 0;
      app.ui.setDimension('2d');
      app.selectOnly(-1, false);
      app.ui.setSelectedLabel(null);
      toast('', false);
    }

    if (shot.index === 1) {
      app.selectOnly(state.targetIndex, false);
      app.selectedPosition = [...state.targetPosition];
      app.selectedReadPending = true;
      app.lastSelectedRead = Number.POSITIVE_INFINITY;
      toast('', false);
    }

    if (shot.index === 2) {
      app.openInspector(state.targetIndex);
      app.selectedPosition = [...state.targetPosition];
      state.typedCommitted = false;
      state.saved = false;
      const tagInput = document.querySelector('.tag-input');
      if (tagInput) tagInput.value = '';
    }

    if (shot.index === 3) {
      app.closeInspector();
      hideInspectorInlineStyles();
      toast('', false);
      app.settings.values.showLabels = false;
      app.ui.setSelectedLabel(null);
      app.settings.values.dimension = '3d';
      app.camera.setDimension('3d');
      app.camera.dimension = '3d';
      app.physics.setDimension('3d');
      app.ui.setDimension('3d');
      app.dimensionBlend = 0;
      const matchedDistance = app.camera.distanceForZoom(state.shotStartCamera.zoom);
      setCamera({
        center: state.shotStartCamera.center,
        zoom: state.shotStartCamera.zoom,
        distance: matchedDistance,
        yaw: 0,
        pitch: 0,
      });
      state.shotStartCamera = currentCamera();
    }

    if (shot.index === 4) {
      app.dimensionBlend = 1;
      app.settings.values.dimension = '3d';
      app.camera.dimension = '3d';
      app.settings.values.showLabels = false;
      app.ui.setSelectedLabel(null);
      await app.setFunPhysics(true);
      state.physicsStarted = true;
      state.lastPhysicsPositions = app.physics.getPositions().slice();
      state.shotStartCamera = currentCamera();
    }

    if (shot.index === 5) {
      if (state.lastPhysicsPositions) {
        const offset = state.targetIndex * 3;
        state.heroPosition = [
          state.lastPhysicsPositions[offset],
          state.lastPhysicsPositions[offset + 1],
          state.lastPhysicsPositions[offset + 2],
        ];
      } else {
        state.heroPosition = [...state.targetPosition];
      }
      await app.setFunPhysics(false);
      state.heroStarted = true;
      state.shotStartCamera = currentCamera();
      app.settings.values.showLabels = true;
      app.selectedPosition = [...state.heroPosition];
      app.selectedReadPending = true;
      app.lastSelectedRead = Number.POSITIVE_INFINITY;
      app.ui.setPhysics(false, 'zero-g');
      app.ui.setRuntimeStatus('WEBGPU · MIDNIGHT HQ', '3d');
      toast('', false);
    }
  }

  function directWide(shot) {
    const { center, size } = state.bounds;
    const t = smoother(shot.progress);
    const start = [center[0] - size[0] * 0.045, center[1] + size[1] * 0.025, 0];
    const end = [center[0] + size[0] * 0.035, center[1] - size[1] * 0.015, 0];
    setCamera({
      center: mix3(start, end, t),
      zoom: state.wideZoom * lerp(1, 0.84, t),
      distance: state.app.camera.distance,
      yaw: 0,
      pitch: 0,
    });
    state.app.dimensionBlend = 0;
  }

  function directCloseup(shot) {
    const start = state.shotStartCamera;
    const t = easeOut(shot.progress);
    const closeZoom = 3.15;
    const aspect = state.config.width / state.config.height;
    const desiredCenter = [
      state.targetPosition[0] + closeZoom * aspect * 0.31,
      state.targetPosition[1] + 0.12,
      0,
    ];
    setCamera({
      center: mix3(start.center, desiredCenter, t),
      zoom: lerp(start.zoom, closeZoom, t),
      distance: start.distance,
      yaw: 0,
      pitch: 0,
    });
    state.app.dimensionBlend = 0;
    state.app.selectedPosition = [...state.targetPosition];
  }

  function directInspector(shot) {
    const app = state.app;
    const start = state.shotStartCamera;
    const drift = smoother(shot.progress);
    setCamera({
      center: [
        start.center[0] + 0.14 * drift,
        start.center[1] - 0.05 * drift,
        start.center[2],
      ],
      zoom: start.zoom * lerp(1, 0.95, drift),
      distance: start.distance,
      yaw: 0,
      pitch: 0,
    });
    app.dimensionBlend = 0;
    const inspector = document.querySelector('.inspector');
    const backdrop = document.querySelector('.inspector-backdrop');
    const reveal = smooth(shot.local / Math.max(1, scaledFrame(12)));
    if (inspector) {
      inspector.style.opacity = String(reveal);
      inspector.style.transform = `translateY(-50%) translateX(${lerp(34, 0, reveal).toFixed(3)}px) scale(${lerp(.985, 1, reveal).toFixed(4)})`;
    }
    if (backdrop) backdrop.style.opacity = String(reveal * 0.92);

    const typeStart = Math.max(1, scaledFrame(18));
    const typeEnd = Math.max(typeStart + 1, scaledFrame(46));
    const commitFrame = Math.max(typeEnd + 1, scaledFrame(48));
    const saveFrame = Math.max(commitFrame + 1, scaledFrame(54));
    const tagInput = document.querySelector('.tag-input');
    if (tagInput && !state.typedCommitted) {
      const progress = clamp((shot.local - typeStart) / (typeEnd - typeStart));
      const count = Math.floor(progress * NEW_TAG.length);
      tagInput.value = shot.local < typeStart ? '' : NEW_TAG.slice(0, count);
      if (shot.local >= commitFrame) {
        tagInput.value = NEW_TAG;
        tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        state.typedCommitted = true;
      }
    }

    const saveButton = document.querySelector('.save-node');
    if (saveButton) saveButton.dataset.cinematicPressed = String(shot.local >= saveFrame && shot.local < saveFrame + Math.max(2, scaledFrame(5)));
    if (!state.saved && shot.local >= saveFrame) {
      const form = document.querySelector('.inspector-form');
      if (form && typeof form.requestSubmit === 'function') form.requestSubmit();
      else {
        const node = app.graph.get(state.targetNode.id);
        app.saveNode({
          id: node.id,
          title: node.title,
          description: node.description,
          tags: [...new Set([...node.tags, NEW_TAG])],
          cluster: node.cluster,
        });
      }
      const savedNode = app.graph.get(state.targetNode.id);
      if (!savedNode || !savedNode.tags.includes(NEW_TAG)) {
        throw new Error(`Inspector save did not persist the required “${NEW_TAG}” tag`);
      }
      state.saved = true;
    }
    toast('Saved · persistent worlds', state.saved);
  }

  function directMorph(shot) {
    const app = state.app;
    const start = state.shotStartCamera;
    const t = smoother(shot.progress);
    const desiredCenter = [state.targetPosition[0] + 0.65, state.targetPosition[1], state.targetPosition[2]];
    app.dimensionBlend = t;
    setCamera({
      center: mix3(start.center, desiredCenter, t),
      zoom: start.zoom,
      distance: lerp(start.distance, 10.8, t),
      yaw: lerp(0, Math.PI * 0.23, t),
      pitch: lerp(0, 0.34, t),
    });
  }

  function centroidOfPhysics(positions) {
    let x = 0;
    let y = 0;
    let z = 0;
    const count = Math.max(1, Math.floor(positions.length / 3));
    for (let index = 0; index < count; index += 1) {
      x += positions[index * 3];
      y += positions[index * 3 + 1];
      z += positions[index * 3 + 2];
    }
    return [x / count, y / count, z / count];
  }

  function directPhysics(shot, dt) {
    const app = state.app;
    const positions = app.physics.step(dt);
    app.buffers.writePositions(positions);
    state.lastPhysicsPositions = positions.slice();
    const centroid = centroidOfPhysics(positions);
    const targetOffset = state.targetIndex * 3;
    const subject = [positions[targetOffset], positions[targetOffset + 1], positions[targetOffset + 2]];
    const targetCenter = mix3(centroid, subject, 0.46);
    const start = state.shotStartCamera;
    const arrival = smoother(Math.min(1, shot.progress * 1.55));
    const orbit = smooth(shot.progress);
    setCamera({
      center: mix3(start.center, targetCenter, arrival),
      zoom: start.zoom,
      distance: lerp(start.distance, 17.2, arrival),
      yaw: start.yaw + orbit * Math.PI * 0.64,
      pitch: lerp(start.pitch, 0.42 + Math.sin(shot.progress * Math.PI) * 0.06, arrival),
    });
    app.selectedPosition = subject;
    app.ui.setRuntimeStatus('BOX3D · ZERO-G', '3d');
    toast('Zero-g tethers · deterministic orbit', shot.local < Math.max(1, scaledFrame(31)));
  }

  function directHero(shot) {
    const app = state.app;
    const start = state.shotStartCamera;
    const t = smoother(shot.progress);
    const position = state.heroPosition;
    const targetYaw = start.yaw + 0.24;
    const right = [Math.cos(targetYaw), 0, -Math.sin(targetYaw)];
    const desiredCenter = [
      position[0] + right[0] * 1.35,
      position[1] + 0.18,
      position[2] + right[2] * 1.35,
    ];
    setCamera({
      center: mix3(start.center, desiredCenter, t),
      zoom: start.zoom,
      distance: lerp(start.distance, 8.4, t),
      yaw: lerp(start.yaw, targetYaw, t),
      pitch: lerp(start.pitch, 0.28, t),
    });
    app.selectedPosition = [...position];
    app.settings.values.glow = lerp(1.18, 1.38, smooth(shot.progress));
    app.settings.values.pulse = lerp(0.22, 0.34, smooth(shot.progress));
    app.ui.setRuntimeStatus('WEBGPU · MIDNIGHT HQ', '3d');
  }

  async function prepare(config) {
    if (state.prepared) throw new Error('Cinematic director was prepared more than once');
    const app = window.__hypermindApp;
    if (!app) throw new Error('window.__hypermindApp is missing; load the app with ?capture=1');
    validateApp(app);
    state.app = app;
    state.config = {
      fps: Number(config.fps),
      frames: Number(config.frames),
      width: Number(config.width),
      height: Number(config.height),
      dpr: Number(config.dpr),
    };
    if (!Number.isFinite(state.config.fps) || state.config.fps <= 0) throw new Error('Director fps must be positive');
    if (!Number.isInteger(state.config.frames) || state.config.frames <= 0) throw new Error('Director frames must be a positive integer');

    // app.start() schedules both its loop and a deferred applyFocus(). Let both
    // execute before taking ownership, then cancel the newly scheduled app RAF.
    await nextFrame();
    await nextFrame();
    cancelAnimationFrame(app.frameHandle);
    app.frameHandle = 0;
    await app.physics.initialize();
    await app.gpu.device.queue.onSubmittedWorkDone();

    installCaptureCSS();
    Object.assign(app.settings.values, {
      dimension: '2d',
      cameraMode: 'orbit',
      skin: 'dream',
      palette: 'violet',
      layout: 'clusters',
      physicsEngine: 'webgpu',
      animations: true,
      dragInfluence: true,
      nodeScale: 1.1,
      nodeDensity: 1,
      dreamFieldLayers: 3,
      dreamFieldScale: 1.24,
      dreamWarp: 0.15,
      dreamJitter: 0,
      dreamLodStrength: 0,
      edgeOpacity: 0.52,
      glow: 1.18,
      pulse: 0.22,
      resolutionScale: 1,
      raySteps: 40,
      showLabels: true,
      showLandmarks: false,
      showGrid: true,
      showHelp: true,
    });
    app.applySettingsChange(null);
    app.layoutMotionUntil = 0;
    app.dimensionBlend = 0;
    app.camera.dimension = '2d';
    app.ui.setSkin('dream');
    app.ui.setDimension('2d');
    document.documentElement.dataset.palette = 'violet';
    app.selectOnly(-1, false);

    const targetIndex = app.graph.nodes.findIndex((node) => node.title === TARGET_TITLE);
    if (targetIndex < 0) throw new Error(`The capture scene does not contain “${TARGET_TITLE}”`);
    state.targetIndex = targetIndex;
    state.targetNode = app.graph.nodes[targetIndex];

    await app.gpu.device.queue.onSubmittedWorkDone();
    const indices = app.graph.nodes.map((_, index) => index);
    const snapshots = await app.buffers.readNodes(indices);
    state.positions = indices.map((index) => snapshots.get(index)?.position ?? app.graph.nodes[index].position);
    state.targetPosition = [...state.positions[targetIndex]];
    state.bounds = boundsFor(state.positions);
    const aspect = state.config.width / state.config.height;
    state.wideZoom = Math.max(
      state.bounds.size[1] * 0.58,
      state.bounds.size[0] * 0.5 / Math.max(0.4, aspect),
    ) * 1.1;
    state.probeFrames = [...new Set(BASE_PROBE_FRAMES.map(scaledFrame))].sort((a, b) => a - b);
    state.prepared = true;

    return {
      targetTitle: state.targetNode.title,
      targetId: state.targetNode.id,
      nodeCount: app.graph.nodes.length,
      probeFrames: state.probeFrames,
      pixelWidth: Math.round(state.config.width * state.config.dpr),
      pixelHeight: Math.round(state.config.height * state.config.dpr),
      settings: {
        skin: app.settings.values.skin,
        palette: app.settings.values.palette,
        raySteps: app.settings.values.raySteps,
        dreamFieldLayers: app.settings.values.dreamFieldLayers,
        resolutionScale: app.settings.values.resolutionScale,
      },
    };
  }

  async function renderFrame(frame) {
    if (!state.prepared) throw new Error('Call __hypermindDirector.prepare() before rendering');
    if (!Number.isInteger(frame) || frame < 0 || frame >= state.config.frames) {
      throw new Error(`Frame ${String(frame)} is outside the capture range`);
    }
    if (frame !== state.lastFrame + 1) {
      throw new Error(`Cinematic frames must be sequential: expected ${state.lastFrame + 1}, received ${frame}`);
    }
    const app = state.app;
    const shot = shotDefinition(frame);
    if (shot.index !== state.shot) {
      await enterShot(shot);
      state.shot = shot.index;
    }

    const dt = 1 / state.config.fps;
    const elapsed = frame * dt;
    app.elapsed = elapsed;
    app.lastFrameTime = elapsed * 1000;
    app.layoutMotionUntil = 0;

    if (shot.index === 0) directWide(shot);
    else if (shot.index === 1) directCloseup(shot);
    else if (shot.index === 2) directInspector(shot);
    else if (shot.index === 3) directMorph(shot);
    else if (shot.index === 4) directPhysics(shot, dt);
    else directHero(shot);

    const rect = app.ui.canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2) * app.settings.values.resolutionScale;
    app.gpu.resize(rect.width * scale, rect.height * scale);
    const cameraFrame = app.camera.frame(app.gpu.width, app.gpu.height, app.dimensionBlend);
    const runSimulation = shot.index === 3;
    app.renderer.render({
      camera: cameraFrame,
      settings: app.settings.values,
      elapsed,
      dt,
      dimensionBlend: app.dimensionBlend,
      runSimulation,
    });

    if (app.settings.values.showLabels) {
      app.updateSelectedOverlay(elapsed * 1000, cameraFrame.viewProjection, rect);
    } else {
      app.ui.setSelectedLabel(null);
    }
    await app.gpu.device.queue.onSubmittedWorkDone();
    await nextFrame();
    state.lastFrame = frame;

    return {
      frame,
      time: elapsed,
      shot: shot.name,
      dimensionBlend: app.dimensionBlend,
      pixelWidth: app.gpu.width,
      pixelHeight: app.gpu.height,
      savedTag: Boolean(app.graph.get(state.targetNode.id)?.tags.includes(NEW_TAG)),
    };
  }

  window.__hypermindDirector = Object.freeze({ prepare, renderFrame, setCaptureLayer });
  return 'HyperMind cinematic director installed';
})();
