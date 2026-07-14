import './style.css';
import { CameraController } from './core/camera';
import { clamp, transformPoint } from './core/math';
import type { GraphNode, GraphScene, RenderSkinId, ScenePortal, Vec3, ViewDimension } from './core/types';
import { SettingsStore, type AppSettings } from './config/settings';
import { GraphStore } from './data/GraphStore';
import {
  defaultExportName,
  migrateLocalStorage,
  openBundleFromDisk,
  openPersistenceStore,
  saveBundleToDisk,
  type PersistenceStore,
} from './data/persistence';
import { parseFocus, parseSceneRoute, sceneShareURL, type SceneFocus } from './data/sceneRoute';
import { DEFAULT_SCENE_ID, getScene, SCENES } from './data/scenes';
import { GPUContext } from './gpu/GPUContext';
import { GraphBuffers } from './gpu/GraphBuffers';
import { GraphRenderer } from './gpu/GraphRenderer';
import { Box3DBackend } from './physics/Box3DBackend';
import type { FunPhysicsPreset, PhysicsGraphInput } from './physics/PhysicsBackend';
import { AppUI } from './ui/AppUI';
import { Diagnostics } from './ui/Diagnostics';

interface PointerSession {
  id: number;
  button: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  mode: 'pending' | 'navigate' | 'drag';
  bases: Map<number, { position: Vec3; radius: number }>;
}

interface AddEventDetail {
  title?: string;
  clientX?: number;
  clientY?: number;
}

interface SaveEventDetail {
  id: string;
  title: string;
  description: string;
  tags: string[];
  cluster: number;
}

const INITIAL_ROUTE = parseSceneRoute(window.location.href, SCENES.map((scene) => scene.id), DEFAULT_SCENE_ID);
const LAYOUT_RELAXATION_MS = 3000;
const DIMENSION_BLEND_MS = 3000;

const LAYOUT_SETTING_KEYS = new Set<keyof AppSettings>([
  'dimension',
  'layout',
  'physicsEngine',
  'nodeDensity',
  'repulsion',
  'spring',
  'springLength',
  'centering',
  'damping',
  'clusterStrength',
]);

class HyperMindApp {
  private readonly ui: AppUI;
  private readonly diagnostics: Diagnostics;
  private readonly settings = new SettingsStore();
  private persist: PersistenceStore | null = null;
  private currentScene = getScene(INITIAL_ROUTE.sceneId);
  private currentFocus: SceneFocus = INITIAL_ROUTE.focus;
  private readonly graph = new GraphStore(this.currentScene.id, this.currentScene.graph);
  private readonly camera = new CameraController();
  private readonly physics = new Box3DBackend();
  private gpu!: GPUContext;
  private buffers!: GraphBuffers;
  private renderer!: GraphRenderer;
  private selected = new Set<number>();
  private hovered: number | null = null;
  private pointer: PointerSession | null = null;
  private readonly uiPointers = new Set<number>();
  private linkSource: number | null = null;
  private pendingCreatePosition: Vec3 | null = null;
  private funPhysics = false;
  private funPreset: FunPhysicsPreset = 'zero-g';
  private physicsReady = false;
  private physicsSyncVersion = 0;
  private lastFrameTime = performance.now();
  private elapsed = 0;
  private selectedPosition: Vec3 | null = null;
  private selectedReadPending = false;
  private lastSelectedRead = 0;
  private lastStatusUpdate = 0;
  private frameHandle = 0;
  private layoutMotionUntil = 0;
  private layoutWasMoving = false;
  private positionReadPending = false;
  private positionReadQueued = false;
  private inspectorOpen = false;
  private selectionVersion = 0;
  private dimensionBlend = 0;
  private dimensionBlendFrom = 0;
  private dimensionBlendTo = 0;
  private dimensionBlendStart = 0;

  constructor(root: HTMLElement) {
    this.settings.values.palette = this.currentScene.palette;
    this.settings.values.layout = this.currentScene.layout;
    this.ui = new AppUI(root);
    this.diagnostics = new Diagnostics(root, this.settings);
  }

  async start(): Promise<void> {
    this.ui.setLoading(true, 'Opening local atlas…');
    try {
      this.persist = await openPersistenceStore();
      await migrateLocalStorage(this.persist);
      await this.settings.attachPersistence(this.persist);
      this.settings.values.palette = this.currentScene.palette;
      this.settings.values.layout = this.currentScene.layout;
      await this.graph.attachPersistence(this.persist);

      this.ui.setLoading(true, 'Waking the GPU…');
      this.gpu = await GPUContext.create(this.ui.canvas, {
        onDeviceLost: (message) => this.handleDeviceLost(message),
      });
      this.buffers = new GraphBuffers(this.gpu.device, this.graph, this.settings.values);
      this.renderer = new GraphRenderer(this.gpu, this.buffers);
      this.camera.setDimension(this.settings.values.dimension);
      this.camera.setMode(this.settings.values.cameraMode);
      this.camera.setZoomBounds(this.settings.values.minZoom, this.settings.values.maxZoom);
      this.dimensionBlend = this.settings.values.dimension === '3d' ? 1 : 0;
      this.dimensionBlendFrom = this.dimensionBlend;
      this.dimensionBlendTo = this.dimensionBlend;
      this.bindUI();
      this.ui.setScenes(SCENES, this.currentScene);
      this.ui.setSubclusters(this.currentScene.subclusters, this.currentFocus);
      this.syncUIFromSettings();
      this.ui.setNodeCount(this.graph.nodes.length, this.graph.edges.length);
      this.ui.setLoading(false);
      this.lastFrameTime = performance.now();
      this.frameHandle = requestAnimationFrame(this.frame);
      requestAnimationFrame(() => this.applyFocus(this.currentFocus, false));
      void this.physics.initialize();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(error);
      this.ui.setUnsupported(message);
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerup', this.onUiPointerEnd);
    window.removeEventListener('pointercancel', this.onUiPointerEnd);
    const shell = this.ui.canvas.parentElement;
    shell?.removeEventListener('pointerdown', this.onUiPointerDown, true);
    const canvas = this.ui.canvas;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerUp);
    canvas.removeEventListener('dblclick', this.onDoubleClick);
    canvas.removeEventListener('wheel', this.onWheel);
    this.physics.dispose();
    if (!this.gpu) return;
    void this.gpu.device.queue.onSubmittedWorkDone().then(() => {
      this.renderer?.dispose();
      this.buffers?.dispose();
      this.gpu.dispose();
    });
  }

  private readonly frame = (now: number): void => {
    const rawDt = (now - this.lastFrameTime) / 1000;
    const dt = clamp(rawDt, 0, 1 / 20);
    this.lastFrameTime = now;
    this.elapsed += dt;
    this.diagnostics.beginFrame();

    const rect = this.ui.canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2) * this.settings.values.resolutionScale;
    this.gpu.resize(rect.width * scale, rect.height * scale);
    this.camera.update(dt);
    this.updateDimensionBlend(now);

    const layoutIsMoving = this.funPhysics || now < this.layoutMotionUntil;
    if (this.isBox3DRunning() && this.physicsReady) {
      const positions = this.physics.step(layoutIsMoving ? dt : 0);
      this.buffers.writePositions(positions);
      this.graph.persistPositions(positions, 3);
      if (this.funPhysics && positions.length >= 3) {
        let centerX = 0;
        let centerY = 0;
        let centerZ = 0;
        const count = positions.length / 3;
        for (let index = 0; index < positions.length; index += 3) {
          centerX += positions[index]!;
          centerY += positions[index + 1]!;
          centerZ += positions[index + 2]!;
        }
        const follow = 1 - Math.exp(-2.4 * dt);
        this.camera.targetCenter[0] += (centerX / count - this.camera.targetCenter[0]) * follow;
        this.camera.targetCenter[1] += (centerY / count - this.camera.targetCenter[1]) * follow;
        this.camera.targetCenter[2] += (centerZ / count - this.camera.targetCenter[2]) * follow;
      }
    }

    const cameraFrame = this.camera.frame(this.gpu.width, this.gpu.height, this.dimensionBlend);
    this.renderer.render({
      camera: cameraFrame,
      settings: this.settings.values,
      elapsed: this.elapsed,
      dt,
      dimensionBlend: this.dimensionBlend,
      runSimulation: !this.isBox3DRunning() && layoutIsMoving,
    });

    const gpuLayoutMoving = !this.isBox3DRunning() && layoutIsMoving;
    if (this.layoutWasMoving && !gpuLayoutMoving) this.queueGpuPositionPersist();
    this.layoutWasMoving = gpuLayoutMoving;

    this.updateSelectedOverlay(now, cameraFrame.viewProjection, rect);
    this.diagnostics.endFrame(rawDt * 1000);
    if (now - this.lastStatusUpdate > 350) {
      this.lastStatusUpdate = now;
      this.ui.setRuntimeStatus(
        this.funPhysics
          ? `BOX3D · ${this.funPreset.toUpperCase()}`
          : `${this.isBox3DRunning() ? 'BOX3D' : 'WEBGPU'} · ${layoutIsMoving ? 'LAYOUT' : 'STATIC'}`,
        this.camera.dimension,
      );
    }
    this.frameHandle = requestAnimationFrame(this.frame);
  };

  private bindUI(): void {
    const listen = <T>(type: string, handler: (detail: T) => void): void => {
      this.ui.addEventListener(type, (event) => handler((event as CustomEvent<T>).detail));
    };
    listen<ViewDimension>('dimension', (dimension) => this.settings.set('dimension', dimension));
    listen<RenderSkinId>('skin', (skin) => this.settings.set('skin', skin));
    listen<string>('scene', (sceneId) => void this.switchScene(sceneId, { type: 'topic' }));
    listen<SceneFocus>('focus', (focus) => this.applyFocus(focus));
    listen<null>('share', () => void this.copyShareLink(this.currentFocus));
    listen<{ id: string }>('share-node', ({ id }) => void this.copyShareLink({ type: 'node', id }));
    listen<ScenePortal>('portal', (portal) => void this.openPortal(portal));
    listen<AddEventDetail>('add', (detail) => this.addNode(detail));
    listen<SaveEventDetail>('save', (detail) => this.saveNode(detail));
    listen<{ id: string }>('delete', ({ id }) => this.deleteNode(id));
    listen<{ id: string }>('link', ({ id }) => this.beginLink(id));
    listen<null>('inspector-close', () => { this.inspectorOpen = false; });
    listen<boolean>('physics-toggle', (active) => void this.setFunPhysics(active));
    listen<FunPhysicsPreset>('physics-preset', (preset) => void this.setFunPreset(preset));
    listen<{ query: string } | string>('search', (detail) => this.search(typeof detail === 'string' ? detail : detail.query));
    listen<'scene' | 'all'>('export', (scope) => void this.exportAtlas(scope));
    listen<null>('import', () => void this.importAtlas());

    this.settings.addEventListener('change', (event) => {
      const key = (event as CustomEvent<{ key: keyof AppSettings | null }>).detail.key;
      this.applySettingsChange(key);
    });
    this.settings.addEventListener('reset', () => {
      this.diagnostics.refresh();
      this.ui.toast('Defaults restored');
    });
    this.graph.addEventListener('change', (event) => {
      const kind = (event as CustomEvent<{ kind: 'topology' | 'content' }>).detail.kind;
      if (kind === 'topology') {
        this.clearSelection();
        this.buffers.rebuild(this.settings.values);
        this.ui.setNodeCount(this.graph.nodes.length, this.graph.edges.length);
      } else {
        this.buffers.updatePalette(this.settings.values);
      }
      this.wakeLayoutMotion();
      if (this.isBox3DRunning()) void this.syncPhysicsGraph(false);
    });

    const canvas = this.ui.canvas;
    const shell = canvas.parentElement;
    shell?.addEventListener('pointerdown', this.onUiPointerDown, true);
    window.addEventListener('pointerup', this.onUiPointerEnd);
    window.addEventListener('pointercancel', this.onUiPointerEnd);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('dblclick', this.onDoubleClick);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private readonly onUiPointerDown = (event: PointerEvent): void => {
    if (!(event.target instanceof Element) || event.target === this.ui.canvas) return;
    this.uiPointers.add(event.pointerId);
    this.setCanvasInputBlocked(true);
    this.cancelPointerSession();
  };

  private readonly onUiPointerEnd = (event: PointerEvent): void => {
    if (!this.uiPointers.delete(event.pointerId)) return;
    if (this.uiPointers.size === 0) this.setCanvasInputBlocked(false);
  };

  private setCanvasInputBlocked(blocked: boolean): void {
    this.ui.canvas.classList.toggle('is-input-blocked', blocked);
  }

  private cancelPointerSession(): void {
    const pointer = this.pointer;
    if (!pointer) return;
    if (this.ui.canvas.hasPointerCapture(pointer.id)) {
      this.ui.canvas.releasePointerCapture(pointer.id);
    }
    if (pointer.mode === 'drag') {
      for (const index of pointer.bases.keys()) {
        const node = this.graph.nodes[index];
        if (!node) continue;
        this.buffers.updateNodeMeta(index, this.selected.has(index), false, node.pinned ? 1 : 0);
        if (this.isBox3DRunning() && this.physicsReady) this.physics.endDrag(node.id);
      }
    }
    this.pointer = null;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.uiPointers.size > 0 || event.button > 2) return;
    this.ui.canvas.setPointerCapture(event.pointerId);
    this.pointer = {
      id: event.pointerId,
      button: event.button,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      mode: event.button === 0 ? 'pending' : 'navigate',
      bases: new Map(),
    };
    if (event.button !== 0) return;

    const rect = this.ui.canvas.getBoundingClientRect();
    const pixelX = (event.clientX - rect.left) * (this.gpu.width / Math.max(1, rect.width));
    const pixelY = (event.clientY - rect.top) * (this.gpu.height / Math.max(1, rect.height));
    const pointerId = event.pointerId;
    void this.renderer.pick(pixelX, pixelY).then((index) => this.resolvePick(index, pointerId, event.shiftKey));
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.uiPointers.size > 0) return;
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    const totalX = event.clientX - pointer.startX;
    const totalY = event.clientY - pointer.startY;
    if (Math.hypot(totalX, totalY) > 3) pointer.moved = true;

    if (pointer.mode === 'drag' && pointer.bases.size > 0) {
      const worldDelta = this.camera.screenDeltaToWorld(totalX, totalY, this.ui.canvas.clientHeight);
      for (const [index, base] of pointer.bases) {
        const position: Vec3 = [
          base.position[0] + worldDelta[0],
          base.position[1] + worldDelta[1],
          this.camera.dimension === '2d' ? 0 : base.position[2] + worldDelta[2],
        ];
        this.buffers.updateNodePosition(index, position, base.radius);
        this.graph.setNodePosition(index, position);
        if (this.isBox3DRunning() && this.physicsReady) {
          const node = this.graph.nodes[index]!;
          this.physics.updateDrag(node.id, { x: position[0], y: position[1], z: position[2] });
        }
        if (index === this.firstSelected()) this.selectedPosition = position;
      }
    } else if (pointer.mode === 'navigate' || (pointer.mode === 'pending' && pointer.moved)) {
      pointer.mode = 'navigate';
      if (this.camera.dimension === '2d' || pointer.button === 1 || event.shiftKey) {
        this.camera.pan(dx, dy, this.ui.canvas.clientHeight);
      } else {
        this.camera.orbit(dx, dy);
      }
    }
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const pointer = this.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.mode === 'drag') {
      for (const index of pointer.bases.keys()) {
        const node = this.graph.nodes[index];
        if (!node) continue;
        this.buffers.updateNodeMeta(index, this.selected.has(index), false, node.pinned ? 1 : 0);
        if (this.isBox3DRunning() && this.physicsReady) this.physics.endDrag(node.id);
      }
    } else if (!pointer.moved && pointer.mode === 'navigate' && pointer.button === 0) {
      this.clearSelection();
    }
    this.pointer = null;
  };

  private readonly onDoubleClick = (event: MouseEvent): void => {
    if (this.uiPointers.size > 0) return;
    event.preventDefault();
    const rect = this.ui.canvas.getBoundingClientRect();
    const pixelX = (event.clientX - rect.left) * (this.gpu.width / Math.max(1, rect.width));
    const pixelY = (event.clientY - rect.top) * (this.gpu.height / Math.max(1, rect.height));
    void this.renderer.pick(pixelX, pixelY).then((index) => {
      if (index !== null && index >= 0 && index < this.graph.nodes.length) {
        this.selectOnly(index);
        this.openInspector(index);
        return;
      }
      this.pendingCreatePosition = this.camera.dimension === '2d'
        ? this.camera.screenToWorld2D(event.clientX, event.clientY, rect)
        : [...this.camera.center] as Vec3;
      this.ui.showComposer(true, event.clientX, event.clientY);
    });
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.uiPointers.size > 0) return;
    event.preventDefault();
    this.camera.zoomAt(event.deltaY, event.clientX, event.clientY, this.ui.canvas.getBoundingClientRect());
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    const typing = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
    if (event.key === 'Escape') {
      if (this.inspectorOpen || this.ui.isInspectorOpen()) {
        event.preventDefault();
        this.closeInspector();
        return;
      }
      if (typing || event.repeat) return;
      this.linkSource = null;
      this.ui.showComposer(false);
      this.clearSelection();
      return;
    }
    if (typing || event.repeat) return;
    if (event.code === 'Space') {
      const index = this.firstSelected();
      if (index !== null) {
        event.preventDefault();
        this.openInspector(index);
        return;
      }
    }
    this.camera.key(event.code, true);
    if (event.key === '/') {
      event.preventDefault();
      this.diagnostics.toggle();
    } else if (event.key === 'm' || event.key === 'M') {
      this.settings.set('showLandmarks', !this.settings.values.showLandmarks);
      this.diagnostics.refresh();
    } else if (event.key === '.') {
      this.settings.reset();
    } else if (event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      this.settings.set('dimension', this.settings.values.dimension === '2d' ? '3d' : '2d');
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      void this.focusSelection();
    } else if (event.key === 'p' || event.key === 'P') {
      event.preventDefault();
      void this.setFunPhysics(!this.funPhysics);
    } else if (event.key === '1' || event.key === '2' || event.key === '3') {
      const skin = ({ '1': 'simple', '2': 'luminous', '3': 'dream' } as const)[event.key];
      this.settings.set('skin', skin);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.camera.key(event.code, false);
  };

  private async resolvePick(index: number | null, pointerId: number, additive: boolean): Promise<void> {
    const pointer = this.pointer;
    if (index === null || index < 0 || index >= this.graph.nodes.length) {
      if (pointer?.id === pointerId) pointer.mode = 'navigate';
      return;
    }
    if (this.linkSource !== null && this.linkSource !== index) {
      const source = this.graph.nodes[this.linkSource];
      const target = this.graph.nodes[index];
      if (source && target && this.graph.link(source.id, target.id)) this.ui.toast(`Linked ${source.title} → ${target.title}`);
      this.linkSource = null;
      this.selectOnly(index);
      return;
    }

    if (additive) {
      if (this.selected.has(index)) this.selected.delete(index);
      else this.selected.add(index);
      this.refreshSelectionVisuals();
      const first = this.firstSelected();
      if (first !== null) this.setRouteFocus({ type: 'node', id: this.graph.nodes[first]!.id });
      else this.setRouteFocus({ type: 'topic' });
    } else if (!this.selected.has(index)) {
      this.selectOnly(index);
    } else {
      this.showSelectedPeek(index);
    }
    if (!this.selected.has(index)) return;

    const snapshots = await this.buffers.readNodes([...this.selected]);
    const currentPointer = this.pointer;
    if (!currentPointer || currentPointer.id !== pointerId) return;
    currentPointer.bases = snapshots;
    currentPointer.mode = 'drag';
    for (const selectedIndex of this.selected) {
      const node = this.graph.nodes[selectedIndex]!;
      const snapshot = snapshots.get(selectedIndex);
      const pinMode = this.settings.values.dragInfluence ? 1 : -1;
      this.buffers.updateNodeMeta(selectedIndex, true, false, pinMode);
      if (snapshot && this.isBox3DRunning() && this.physicsReady) {
        this.physics.beginDrag(node.id, { x: snapshot.position[0], y: snapshot.position[1], z: snapshot.position[2] });
      }
    }
  }

  private addNode(detail: AddEventDetail): void {
    const rect = this.ui.canvas.getBoundingClientRect();
    const position = this.pendingCreatePosition ?? (
      detail.clientX !== undefined && detail.clientY !== undefined && this.camera.dimension === '2d'
        ? this.camera.screenToWorld2D(detail.clientX, detail.clientY, rect)
        : [...this.camera.center] as Vec3
    );
    const selectedNode = this.graph.nodes[this.firstSelected() ?? -1];
    const node = this.graph.addNode(
      detail.title ?? 'Untitled thought',
      position,
      selectedNode?.cluster ?? 0,
      selectedNode?.subcluster,
    );
    this.pendingCreatePosition = null;
    this.ui.showComposer(false);
    if (!node) {
      this.ui.toast('The interactive tier is full (256 nodes).');
      return;
    }
    if (selectedNode) this.graph.link(selectedNode.id, node.id);
    const index = this.graph.indexOf(node.id);
    this.selectOnly(index);
    this.ui.toast('Thought added');
  }

  private saveNode(detail: SaveEventDetail): void {
    this.graph.updateNode(detail.id, {
      title: detail.title.trim() || 'Untitled thought',
      description: detail.description,
      tags: detail.tags,
      cluster: clamp(Math.round(detail.cluster), 0, 4),
    });
    const node = this.graph.get(detail.id);
    if (node && this.inspectorOpen) this.ui.showInspector(node);
    this.ui.toast('Saved');
  }

  private deleteNode(id: string): void {
    const node = this.graph.get(id);
    if (!node) return;
    this.graph.deleteNode(id);
    this.ui.toast(`${node.title} removed`);
  }

  private beginLink(id: string): void {
    const index = this.graph.indexOf(id);
    if (index < 0) return;
    this.linkSource = index;
    this.ui.toast('Choose another node to connect · Esc cancels');
  }

  private search(query: string): void {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;
    const index = this.graph.nodes.findIndex((node) =>
      node.title.toLowerCase().includes(normalized) || node.tags.some((tag) => tag.toLowerCase().includes(normalized)));
    if (index < 0) {
      this.ui.toast('No matching thought');
      return;
    }
    this.applyFocus({ type: 'node', id: this.graph.nodes[index]!.id });
  }

  private async switchScene(sceneId: string, focus: SceneFocus, updateURL = true): Promise<void> {
    const scene = getScene(sceneId);
    const isNewScene = scene.id !== this.currentScene.id;
    if (isNewScene) {
      await this.flushLivePositions();
      this.currentScene = scene;
      this.currentFocus = { type: 'topic' };
      this.settings.set('palette', scene.palette);
      this.settings.set('layout', scene.layout);
      await this.graph.switchScene(scene.id, scene.graph);
      this.ui.setScene(scene);
      this.ui.setSubclusters(scene.subclusters, focus);
      this.ui.setNodeCount(this.graph.nodes.length, this.graph.edges.length);
    }
    requestAnimationFrame(() => this.applyFocus(focus, updateURL));
    if (isNewScene) this.ui.toast(`${scene.shortTitle} loaded`);
  }

  private async exportAtlas(scope: 'scene' | 'all'): Promise<void> {
    if (!this.persist) {
      this.ui.toast('Local storage is not ready yet');
      return;
    }
    await this.flushLivePositions();
    await this.persist.saveSettings(this.settings.snapshot());
    const bundle = await this.persist.exportBundle(scope === 'scene' ? [this.currentScene.id] : undefined);
    const saved = await saveBundleToDisk(
      bundle,
      defaultExportName(scope === 'scene' ? this.currentScene.id : undefined),
    );
    if (saved) {
      const count = Object.keys(bundle.scenes).length;
      this.ui.toast(count === 1 ? 'Exported this world' : `Exported ${count} worlds`);
    }
  }

  private async importAtlas(): Promise<void> {
    if (!this.persist) {
      this.ui.toast('Local storage is not ready yet');
      return;
    }
    try {
      const bundle = await openBundleFromDisk();
      if (!bundle) return;
      const imported = await this.persist.importBundle(bundle, 'replace');
      if (bundle.settings?.values) {
        Object.assign(this.settings.values, bundle.settings.values);
        this.settings.changed();
      }
      if (imported.includes(this.currentScene.id)) {
        await this.graph.attachPersistence(this.persist);
        this.buffers.rebuild(this.settings.values);
        this.ui.setNodeCount(this.graph.nodes.length, this.graph.edges.length);
        requestAnimationFrame(() => this.applyFocus({ type: 'topic' }, false));
      }
      this.ui.toast(imported.length === 1 ? 'Imported world' : `Imported ${imported.length} worlds`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ui.toast(message);
    }
  }

  private applyFocus(requestedFocus: SceneFocus, updateURL = true): void {
    const focus = this.normalizeFocus(this.currentScene, requestedFocus);
    this.currentFocus = focus;
    this.ui.setFocus(focus);
    if (updateURL) this.updateRoute();

    if (focus.type === 'node') {
      const index = this.graph.indexOf(focus.id);
      if (index < 0) return;
      this.selectOnly(index, false);
      const neighbors = new Set<number>([index]);
      for (const edge of this.graph.edges) {
        if (edge.source === focus.id) neighbors.add(this.graph.indexOf(edge.target));
        else if (edge.target === focus.id) neighbors.add(this.graph.indexOf(edge.source));
      }
      void this.frameIndices([...neighbors].filter((value) => value >= 0), index);
      return;
    }

    this.clearSelection(false);
    const indices = focus.type === 'topic'
      ? this.graph.nodes.map((_, index) => index)
      : this.graph.nodes.flatMap((node, index) => node.subcluster === focus.id ? [index] : []);
    void this.frameIndices(indices);
  }

  private async frameIndices(indices: number[], anchorIndex?: number): Promise<void> {
    if (indices.length === 0) return;
    const sceneId = this.currentScene.id;
    const snapshots = await this.buffers.readNodes(indices);
    if (sceneId !== this.currentScene.id || snapshots.size === 0) return;

    if (anchorIndex !== undefined) {
      const anchor = snapshots.get(anchorIndex);
      if (!anchor) return;
      this.camera.targetCenter = [...anchor.position];
      let neighborRadius = 0;
      for (const { position } of snapshots.values()) {
        neighborRadius = Math.max(neighborRadius, Math.hypot(
          position[0] - anchor.position[0],
          position[1] - anchor.position[1],
          position[2] - anchor.position[2],
        ));
      }
      if (this.camera.dimension === '2d') this.camera.targetZoom = clamp(neighborRadius * 0.72 + 3.4, 3.8, 8.5);
      else this.camera.targetDistance = clamp(neighborRadius * 1.5 + 6, 8, 18);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (const { position, radius } of snapshots.values()) {
      minX = Math.min(minX, position[0] - radius);
      minY = Math.min(minY, position[1] - radius);
      minZ = Math.min(minZ, position[2] - radius);
      maxX = Math.max(maxX, position[0] + radius);
      maxY = Math.max(maxY, position[1] + radius);
      maxZ = Math.max(maxZ, position[2] + radius);
    }
    const center: Vec3 = [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5];
    this.camera.targetCenter = center;
    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;
    const aspect = this.ui.canvas.clientWidth / Math.max(1, this.ui.canvas.clientHeight);
    const padding = this.currentFocus.type === 'subcluster' ? 1.38 : 1.2;
    if (this.camera.dimension === '2d') {
      this.camera.targetZoom = clamp(Math.max(height * 0.5, width * 0.5 / Math.max(aspect, 0.4)) * padding, 4.5, 70);
    } else {
      this.camera.targetDistance = clamp(Math.hypot(width, height, depth) * 1.28 * padding, 10, 110);
    }
  }

  private normalizeFocus(scene: GraphScene, focus: SceneFocus): SceneFocus {
    if (focus.type === 'node' && !scene.graph.nodes.some((node) => node.id === focus.id) && this.graph.indexOf(focus.id) < 0) {
      return { type: 'topic' };
    }
    if (focus.type === 'subcluster' && !scene.subclusters.some((group) => group.id === focus.id)) {
      return { type: 'topic' };
    }
    return focus;
  }

  private async openPortal(portal: ScenePortal): Promise<void> {
    await this.switchScene(portal.scene, parseFocus(portal.focus ?? null));
  }

  private async copyShareLink(focus: SceneFocus): Promise<void> {
    const normalized = this.normalizeFocus(this.currentScene, focus);
    const url = sceneShareURL(window.location.href, this.currentScene.id, normalized);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('textarea');
      input.value = url;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.append(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    this.ui.toast(normalized.type === 'topic' ? 'Topic link copied' : normalized.type === 'node' ? 'Node link copied' : 'Subcluster link copied');
  }

  private setRouteFocus(focus: SceneFocus): void {
    this.currentFocus = focus;
    this.ui.setFocus(focus);
    this.updateRoute();
  }

  private updateRoute(): void {
    history.replaceState(null, '', sceneShareURL(window.location.href, this.currentScene.id, this.currentFocus));
  }

  private async setFunPhysics(active: boolean): Promise<void> {
    if (active === this.funPhysics && (!active || this.physicsReady)) return;
    this.funPhysics = active;
    this.ui.setPhysics(active, this.funPreset);
    if (active) {
      this.ui.toast('Loading Box3D physics…');
      await this.syncPhysicsGraph(true);
      if (!this.funPhysics || !this.physicsReady) return;
      this.physics.setFunPreset(this.funPreset);
      this.physics.burst(this.funPreset === 'elastic' ? 5.5 : this.funPreset === 'lunar' ? 2.8 : 4.2);
      this.ui.toast(this.funPreset === 'zero-g' ? 'Zero-g tethers live' : this.funPreset === 'lunar' ? 'Lunar gravity live' : 'Elastic web live');
    } else {
      this.physics.clearFunPreset();
      this.configurePhysics();
      this.layoutMotionUntil = 0;
      this.ui.toast('Back to data mode');
    }
  }

  private async setFunPreset(preset: FunPhysicsPreset): Promise<void> {
    this.funPreset = preset;
    this.ui.setPhysics(this.funPhysics, preset);
    if (!this.funPhysics) await this.setFunPhysics(true);
    if (!this.physicsReady) return;
    this.physics.setFunPreset(preset);
    this.physics.burst(preset === 'elastic' ? 5.5 : preset === 'lunar' ? 2.8 : 4.2);
  }

  private async syncPhysicsGraph(burstAfterSync: boolean): Promise<void> {
    const version = ++this.physicsSyncVersion;
    this.physicsReady = false;
    const indices = this.graph.nodes.map((_, index) => index);
    try {
      const snapshots = await this.buffers.readNodes(indices);
      const input: PhysicsGraphInput = {
        nodes: this.graph.nodes.map((node, index) => {
          const position = snapshots.get(index)?.position ?? node.position;
          return {
            id: node.id,
            position: { x: position[0], y: position[1], z: position[2] },
            radius: node.radius * this.settings.values.nodeScale,
            cluster: node.cluster,
            pinned: node.pinned,
          };
        }),
        edges: this.graph.edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          strength: edge.strength,
          restLength: this.settings.values.springLength,
        })),
      };
      await this.physics.setGraph(input);
      if (version !== this.physicsSyncVersion) return;
      this.configurePhysics();
      if (this.funPhysics) {
        this.physics.setFunPreset(this.funPreset);
        if (burstAfterSync) this.physics.burst(4.2);
      }
      this.physicsReady = true;
    } catch (error) {
      console.error('Box3D initialization failed', error);
      this.funPhysics = false;
      this.physicsReady = false;
      this.ui.setPhysics(false, this.funPreset);
      this.ui.toast('Box3D could not start; WebGPU layout is still active.');
    }
  }

  private configurePhysics(): void {
    const settings = this.settings.values;
    this.physics.configure({
      dimension: settings.dimension,
      centerStrength: settings.centering * 2.8,
      clusterStrength: settings.clusterStrength * 2.5,
      linkStrength: settings.spring * 2.2,
      linkDistance: settings.springLength,
      linkDamping: settings.damping,
      linearDamping: 0.45 + settings.damping,
      collisionRadiusScale: 1.04 / settings.nodeDensity,
      maximumLinearSpeed: 48,
      timeScale: settings.simulationSpeed,
    });
  }

  private updateDimensionBlend(now: number): void {
    const duration = Math.max(1, DIMENSION_BLEND_MS);
    const t = clamp((now - this.dimensionBlendStart) / duration, 0, 1);
    const eased = t * t * (3 - 2 * t);
    this.dimensionBlend = this.dimensionBlendFrom + (this.dimensionBlendTo - this.dimensionBlendFrom) * eased;
    this.camera.setTransitioning(t < 1);
  }

  private beginDimensionBlend(dimension: ViewDimension): void {
    this.dimensionBlendFrom = this.dimensionBlend;
    this.dimensionBlendTo = dimension === '3d' ? 1 : 0;
    this.dimensionBlendStart = performance.now();
  }

  private applySettingsChange(key: keyof AppSettings | null): void {
    const settings = this.settings.values;
    if (key === 'dimension') {
      this.beginDimensionBlend(settings.dimension);
      this.camera.setDimension(settings.dimension);
      this.physics.setDimension(settings.dimension);
    } else if (key === null) {
      this.dimensionBlend = settings.dimension === '3d' ? 1 : 0;
      this.dimensionBlendFrom = this.dimensionBlend;
      this.dimensionBlendTo = this.dimensionBlend;
      this.camera.setTransitioning(false);
      this.camera.setDimension(settings.dimension);
      this.physics.setDimension(settings.dimension);
    }
    if (key === null || key === 'cameraMode') this.camera.setMode(settings.cameraMode);
    if (key === null || key === 'minZoom' || key === 'maxZoom') {
      this.camera.setZoomBounds(settings.minZoom, settings.maxZoom);
    }
    if (key === null || key === 'palette') this.buffers.updatePalette(settings);
    if (this.physics.initialized) this.configurePhysics();
    if ((key === 'physicsEngine' || key === null) && settings.physicsEngine === 'box3d' && !this.physicsReady) {
      void this.syncPhysicsGraph(false);
    }
    if (key === null || LAYOUT_SETTING_KEYS.has(key)) this.wakeLayoutMotion();
    if (key !== null) this.diagnostics.refresh();
    this.syncUIFromSettings();
  }

  private syncUIFromSettings(): void {
    this.ui.setDimension(this.settings.values.dimension);
    this.ui.setSkin(this.settings.values.skin);
    this.ui.setPhysics(this.funPhysics, this.funPreset);
    this.ui.setScene(this.currentScene);
    document.documentElement.dataset.palette = this.settings.values.palette;
    document.documentElement.classList.toggle('is-help-hidden', !this.settings.values.showHelp);
  }

  private isBox3DRunning(): boolean {
    return this.funPhysics || this.settings.values.physicsEngine === 'box3d';
  }

  private wakeLayoutMotion(duration = LAYOUT_RELAXATION_MS): void {
    if (this.funPhysics) return;
    this.layoutMotionUntil = Math.max(this.layoutMotionUntil, performance.now() + duration);
  }

  private queueGpuPositionPersist(): void {
    if (this.positionReadPending) {
      this.positionReadQueued = true;
      return;
    }
    this.positionReadPending = true;
    const sceneId = this.graph.sceneId;
    void this.buffers.readPositions()
      .then((positions) => {
        if (sceneId === this.graph.sceneId) this.graph.persistPositions(positions);
      })
      .catch((error) => console.error('Failed to read live graph positions', error))
      .finally(() => {
        this.positionReadPending = false;
        if (this.positionReadQueued) {
          this.positionReadQueued = false;
          this.queueGpuPositionPersist();
        }
      });
  }

  private async flushLivePositions(): Promise<void> {
    if (!this.buffers || !this.gpu) {
      await this.graph.flushPositions();
      return;
    }
    if (this.isBox3DRunning() && this.physicsReady) {
      this.graph.persistPositions(this.physics.getPositions(), 3);
    } else {
      await this.gpu.device.queue.onSubmittedWorkDone();
      this.graph.persistPositions(await this.buffers.readPositions());
    }
    await this.graph.flushPositions();
  }

  private selectOnly(index: number, updateFocus = true): void {
    this.selectionVersion += 1;
    this.selected = new Set(index >= 0 ? [index] : []);
    this.selectedPosition = index >= 0 && this.graph.nodes[index]
      ? [...this.graph.nodes[index]!.position]
      : null;
    this.refreshSelectionVisuals();
    if (index >= 0) {
      this.showSelectedPeek(index);
      if (updateFocus) this.setRouteFocus({ type: 'node', id: this.graph.nodes[index]!.id });
    }
  }

  private clearSelection(resetFocus = true): void {
    if (this.selected.size === 0) {
      this.closeInspector();
      if (resetFocus) this.setRouteFocus({ type: 'topic' });
      return;
    }
    this.selectionVersion += 1;
    this.selected.clear();
    this.selectedPosition = null;
    this.refreshSelectionVisuals();
    this.closeInspector();
    this.ui.setSelectedLabel(null);
    if (resetFocus) this.setRouteFocus({ type: 'topic' });
  }

  private refreshSelectionVisuals(): void {
    for (let index = 0; index < this.graph.nodes.length; index += 1) {
      const node = this.graph.nodes[index]!;
      this.buffers.updateNodeMeta(index, this.selected.has(index), this.hovered === index, node.pinned ? 1 : 0);
    }
    const first = this.firstSelected();
    if (first === null) {
      this.closeInspector();
      this.ui.setSelectedLabel(null);
    } else {
      this.showSelectedPeek(first);
    }
  }

  private showSelectedPeek(index: number): void {
    const node = this.graph.nodes[index];
    if (!node) return;
    if (this.inspectorOpen) this.ui.showInspector(node);
    const blurb = this.settings.values.showLabels ? nodeBlurb(node) : null;
    this.ui.setSelectedLabel(this.settings.values.showLabels ? node.title : null, blurb);
    this.lastSelectedRead = 0;
  }

  private openInspector(index: number): void {
    const node = this.graph.nodes[index];
    if (!node) return;
    this.inspectorOpen = true;
    this.ui.showComposer(false);
    this.ui.showInspector(node);
  }

  private closeInspector(): void {
    if (!this.inspectorOpen && !this.ui.isInspectorOpen()) return;
    this.inspectorOpen = false;
    this.ui.showInspector(null);
  }

  private async focusSelection(): Promise<void> {
    const index = this.firstSelected();
    if (index === null) {
      this.ui.toast('Select a node, then press F to focus');
      return;
    }
    if (this.selectedPosition) {
      this.camera.focus(this.selectedPosition);
      return;
    }
    const snapshots = await this.buffers.readNodes([index]);
    const node = snapshots.get(index);
    if (node) this.camera.focus(node.position);
  }

  private firstSelected(): number | null {
    return this.selected.values().next().value ?? null;
  }

  private updateSelectedOverlay(now: number, viewProjection: Float32Array, rect: DOMRect): void {
    const index = this.firstSelected();
    if (index === null || !this.settings.values.showLabels || this.inspectorOpen) {
      if (this.inspectorOpen) this.ui.setSelectedLabel(null);
      else if (index === null || !this.settings.values.showLabels) this.ui.setSelectedLabel(null);
      return;
    }
    if (this.isBox3DRunning() && this.physicsReady) {
      const positions = this.physics.getPositions();
      const offset = index * 3;
      this.selectedPosition = [positions[offset]!, positions[offset + 1]!, positions[offset + 2]!];
    } else if (!this.selectedReadPending && now - this.lastSelectedRead > 50) {
      this.lastSelectedRead = now;
      this.selectedReadPending = true;
      const selectionVersion = this.selectionVersion;
      void this.buffers.readNodes([index]).then((result) => {
        if (selectionVersion === this.selectionVersion && this.firstSelected() === index) {
          this.selectedPosition = result.get(index)?.position ?? null;
        }
      }).finally(() => { this.selectedReadPending = false; });
    }
    const position = this.selectedPosition;
    const node = this.graph.nodes[index];
    if (!position || !node) return;
    const clip = transformPoint(viewProjection, position);
    const ndcX = clip[0] / Math.max(clip[3], 0.00001);
    const ndcY = clip[1] / Math.max(clip[3], 0.00001);
    if (clip[3] <= 0 || ndcX < -1.08 || ndcX > 1.08 || ndcY < -1.08 || ndcY > 1.08) {
      this.ui.setSelectedLabel(null);
      return;
    }
    const x = (ndcX * 0.5 + 0.5) * rect.width;
    const y = (1 - (ndcY * 0.5 + 0.5)) * rect.height;
    this.ui.setSelectedLabel(node.title, nodeBlurb(node), x, y);
  }

  private handleDeviceLost(message: string): void {
    cancelAnimationFrame(this.frameHandle);
    this.ui.setUnsupported(`The GPU device was lost${message ? `: ${message}` : ''}. Reload to restore the graph.`);
  }
}

function nodeBlurb(node: GraphNode): string {
  const text = node.description.trim();
  if (!text) return '';
  const match = text.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? text).trim();
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('HyperMind could not find its application root.');
const app = new HyperMindApp(root);
const startPromise = app.start();
if (new URLSearchParams(window.location.search).get('capture') === '1') {
  const captureWindow = window as Window & {
    __hypermindApp?: HyperMindApp;
    __hypermindReady?: Promise<void>;
  };
  captureWindow.__hypermindApp = app;
  captureWindow.__hypermindReady = startPromise;
}
void startPromise;
if (import.meta.hot) import.meta.hot.dispose(() => app.dispose());
