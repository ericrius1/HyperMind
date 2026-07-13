import type { GraphNode, GraphScene, RenderSkinId, SceneSubcluster, ViewDimension } from '../core/types';
import type { SceneFocus } from '../data/sceneRoute';
import type { FunPhysicsPreset } from '../physics/PhysicsBackend';

const SKINS: Array<{ id: RenderSkinId; label: string; key: string }> = [
  { id: 'simple', label: 'Paper', key: '1' },
  { id: 'luminous', label: 'Luminous', key: '2' },
  { id: 'dream', label: 'Midnight', key: '3' },
];

export class AppUI extends EventTarget {
  readonly canvas: HTMLCanvasElement;
  private readonly root: HTMLElement;
  private readonly loading: HTMLElement;
  private readonly loadingCopy: HTMLElement;
  private readonly inspector: HTMLElement;
  private readonly inspectorForm: HTMLFormElement;
  private readonly composer: HTMLElement;
  private readonly composerInput: HTMLInputElement;
  private readonly label: HTMLElement;
  private readonly toastElement: HTMLElement;
  private readonly physicsButton: HTMLButtonElement;
  private readonly physicsPanel: HTMLElement;
  private readonly count: HTMLElement;
  private readonly runtime: HTMLElement;
  private readonly sceneSelect: HTMLSelectElement;
  private readonly clusterDock: HTMLElement;
  private readonly portalButton: HTMLButtonElement;
  private readonly dimensionButtons: HTMLButtonElement[];
  private readonly skinButtons: HTMLButtonElement[];
  private toastTimer = 0;

  constructor(root: HTMLElement) {
    super();
    this.root = root;
    root.innerHTML = `
      <main class="app-shell">
        <canvas id="graph-canvas" aria-label="Interactive HyperMind knowledge graph"></canvas>
        <div class="ambient-grain" aria-hidden="true"></div>

        <header class="topbar">
          <div class="brand-block">
            <a class="brand" href="#" aria-label="HyperMind home">
              <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
              <span><b>HYPER</b><strong>MIND</strong></span>
            </a>
            <span class="brand-rule"></span>
            <label class="scene-picker"><span>ATLAS</span><select aria-label="Sample scene"></select></label>
          </div>

          <form class="search" role="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
            <input type="search" placeholder="Find a thought…" aria-label="Find a thought" />
            <kbd>⌘K</kbd>
          </form>

          <div class="top-actions">
            <button class="share-view" type="button" aria-label="Copy link to current view"><span>↗</span> Share view</button>
            <button class="new-thought" type="button"><span>＋</span> New thought</button>
            <div class="dimension-switch" aria-label="View dimension">
              <button type="button" data-dimension="2d">2D</button>
              <button type="button" data-dimension="3d">3D</button>
            </div>
          </div>
        </header>

        <nav class="skin-dock" aria-label="Render modes">
          <span class="dock-label">RENDER</span>
          ${SKINS.map((skin) => `<button type="button" data-skin="${skin.id}"><span>${skin.label}</span><kbd>${skin.key}</kbd></button>`).join('')}
          <span class="dock-divider"></span>
          <button type="button" class="physics-button" aria-pressed="false">
            <span class="physics-icon" aria-hidden="true">✦</span>
            <span><b>Play physics</b><small>BOX3D</small></span>
            <kbd>F</kbd>
          </button>
        </nav>

        <nav class="cluster-dock" aria-label="Scene subclusters">
          <div class="cluster-intro"><span class="scene-kicker"></span><strong class="scene-title"></strong></div>
          <div class="cluster-scroll"></div>
          <button class="share-scope" type="button" aria-label="Copy link to focused scope">↗ <span>Copy view</span></button>
        </nav>

        <section class="physics-panel" aria-label="Physics playground presets">
          <div>
            <span class="eyebrow">PLAYGROUND ACTIVE</span>
            <strong>What kind of beautiful mess?</strong>
          </div>
          <button type="button" data-preset="zero-g"><i>◎</i><span><b>Zero-g tethers</b><small>Soft cables in orbit</small></span></button>
          <button type="button" data-preset="lunar"><i>◒</i><span><b>Lunar drop</b><small>Low gravity + bounce</small></span></button>
          <button type="button" data-preset="elastic"><i>⌁</i><span><b>Elastic web</b><small>Stiff spring chaos</small></span></button>
        </section>

        <aside class="inspector" aria-label="Edit selected thought" aria-hidden="true">
          <form class="inspector-form">
            <div class="inspector-head">
              <div><span class="eyebrow">OPEN THOUGHT</span><span class="live-dot">LIVE</span></div>
              <button class="close-inspector" type="button" aria-label="Close inspector">×</button>
            </div>
            <input type="hidden" name="id" />
            <label class="field title-field"><span>Title</span><input name="title" autocomplete="off" maxlength="80" /></label>
            <label class="field"><span>What does this mean?</span><textarea name="description" rows="6" maxlength="1200"></textarea></label>
            <div class="field-row">
              <label class="field"><span>Tags</span><input name="tags" placeholder="design, system" /></label>
              <label class="field cluster-field"><span>Region</span><select name="cluster">
                <option value="0">Systems</option><option value="1">Making</option><option value="2">Mind</option><option value="3">Technology</option><option value="4">Living world</option>
              </select></label>
            </div>
            <div class="node-meta"><span class="node-id"></span><span>Changes stay local</span></div>
            <div class="inspector-share-row">
              <button class="share-node" type="button"><span>↗</span> Copy node link</button>
              <button class="portal-node" type="button"><span>→</span> <b>Open linked atlas</b></button>
            </div>
            <div class="inspector-actions">
              <button class="save-node" type="submit">Save thought <kbd>⌘↵</kbd></button>
              <button class="link-node" type="button"><span>↗</span> Link from this</button>
              <button class="delete-node" type="button" aria-label="Delete thought">⌫</button>
            </div>
          </form>
        </aside>

        <form class="composer" aria-hidden="true">
          <div class="composer-orb">＋</div>
          <div><span class="eyebrow">NEW THOUGHT</span><input maxlength="80" placeholder="Name the idea…" autocomplete="off" /></div>
          <button type="submit">Create <kbd>↵</kbd></button>
        </form>

        <div class="selected-label" aria-hidden="true"><i></i><span></span></div>

        <footer class="statusbar">
          <div class="runtime-pill"><i></i><span class="runtime-value">WEBGPU · LIVE</span></div>
          <span class="count-value">0 nodes · 0 links</span>
          <span class="status-divider"></span>
          <span class="mode-hint"><b>DRAG</b> pan</span>
          <span class="mode-hint"><b>SCROLL</b> zoom</span>
          <span class="mode-hint"><b>DOUBLE CLICK</b> create</span>
          <span class="mode-hint"><b>SHIFT + CLICK</b> multi-select</span>
          <span class="status-spacer"></span>
          <span class="dimension-value">2D CANVAS</span>
          <span class="slash-hint"><kbd>/</kbd> controls</span>
        </footer>

        <div class="toast" role="status" aria-live="polite"></div>
        <div class="loading-screen">
          <div class="loading-core"><i></i><i></i><i></i><span></span></div>
          <p>Waking the GPU…</p>
        </div>
      </main>`;

    this.canvas = this.required<HTMLCanvasElement>('#graph-canvas');
    this.loading = this.required('.loading-screen');
    this.loadingCopy = this.required('.loading-screen p');
    this.inspector = this.required('.inspector');
    this.inspectorForm = this.required<HTMLFormElement>('.inspector-form');
    this.composer = this.required('.composer');
    this.composerInput = this.required<HTMLInputElement>('.composer input');
    this.label = this.required('.selected-label');
    this.toastElement = this.required('.toast');
    this.physicsButton = this.required<HTMLButtonElement>('.physics-button');
    this.physicsPanel = this.required('.physics-panel');
    this.count = this.required('.count-value');
    this.runtime = this.required('.runtime-value');
    this.sceneSelect = this.required<HTMLSelectElement>('.scene-picker select');
    this.clusterDock = this.required('.cluster-dock');
    this.portalButton = this.required<HTMLButtonElement>('.portal-node');
    this.dimensionButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-dimension]')];
    this.skinButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-skin]')];
    this.bind();
  }

  setDimension(dimension: ViewDimension): void {
    this.dimensionButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.dimension === dimension));
    this.required('.dimension-value').textContent = dimension === '2d' ? '2D CANVAS' : '3D SPACE';
    this.root.classList.toggle('is-3d', dimension === '3d');
  }

  setSkin(skin: RenderSkinId): void {
    this.skinButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.skin === skin));
  }

  setPhysics(active: boolean, preset: FunPhysicsPreset = 'zero-g'): void {
    this.physicsButton.classList.toggle('is-active', active);
    this.physicsButton.setAttribute('aria-pressed', String(active));
    this.physicsPanel.classList.toggle('is-visible', active);
    this.root.classList.toggle('physics-active', active);
    this.physicsPanel.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.preset === preset);
    });
  }

  setNodeCount(nodes: number, edges: number): void {
    this.count.textContent = `${nodes} nodes · ${edges} links`;
  }

  setScenes(scenes: readonly GraphScene[], currentScene: GraphScene): void {
    this.sceneSelect.innerHTML = scenes.map((scene) => `<option value="${scene.id}">${scene.shortTitle}</option>`).join('');
    this.setScene(currentScene);
  }

  setScene(scene: GraphScene): void {
    this.sceneSelect.value = scene.id;
    this.required('.scene-kicker').textContent = scene.kicker;
    this.required('.scene-title').textContent = scene.title;
    const clusterSelect = this.inspectorForm.elements.namedItem('cluster') as HTMLSelectElement;
    clusterSelect.innerHTML = scene.clusterLabels.map((label, index) => `<option value="${index}">${label}</option>`).join('');
  }

  setSubclusters(groups: readonly SceneSubcluster[], focus: SceneFocus): void {
    const scroll = this.required('.cluster-scroll');
    scroll.innerHTML = `<button type="button" data-focus="topic"><span>All</span><small>Topic</small></button>${groups.map((group) =>
      `<button type="button" data-focus="${group.id}" title="${group.description}"><span>${group.label}</span><small>↗ link</small></button>`).join('')}`;
    scroll.querySelectorAll<HTMLButtonElement>('[data-focus]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.focus;
      this.emit('focus', id === 'topic' ? { type: 'topic' } : { type: 'subcluster', id } as SceneFocus);
    }));
    this.setFocus(focus);
  }

  setFocus(focus: SceneFocus): void {
    this.clusterDock.querySelectorAll<HTMLButtonElement>('[data-focus]').forEach((button) => {
      const active = focus.type === 'topic' ? button.dataset.focus === 'topic' : focus.type === 'subcluster' && button.dataset.focus === focus.id;
      button.classList.toggle('is-active', active);
    });
  }

  setRuntimeStatus(status: string, dimension: ViewDimension): void {
    this.runtime.textContent = status;
    this.required('.dimension-value').textContent = dimension === '2d' ? '2D CANVAS' : '3D SPACE';
  }

  setLoading(active: boolean, message = 'Waking the GPU…'): void {
    this.loadingCopy.textContent = message;
    this.loading.classList.toggle('is-hidden', !active);
  }

  setUnsupported(message: string): void {
    this.loading.classList.remove('is-hidden');
    this.loading.classList.add('is-error');
    this.loading.innerHTML = `<div class="error-glyph">!</div><h1>WebGPU needs attention</h1><p></p><button type="button">Reload</button>`;
    this.loading.querySelector('p')!.textContent = message;
    this.loading.querySelector('button')!.addEventListener('click', () => location.reload());
  }

  showInspector(node: GraphNode | null): void {
    if (!node) {
      this.inspector.classList.remove('is-visible');
      this.inspector.setAttribute('aria-hidden', 'true');
      return;
    }
    const field = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(name: string): T =>
      this.inspectorForm.elements.namedItem(name) as T;
    field<HTMLInputElement>('id').value = node.id;
    field<HTMLInputElement>('title').value = node.title;
    field<HTMLTextAreaElement>('description').value = node.description;
    field<HTMLInputElement>('tags').value = node.tags.join(', ');
    field<HTMLSelectElement>('cluster').value = String(node.cluster);
    this.portalButton.classList.toggle('is-visible', Boolean(node.portal));
    this.portalButton.dataset.scene = node.portal?.scene ?? '';
    this.portalButton.dataset.focus = node.portal?.focus ?? '';
    this.portalButton.querySelector('b')!.textContent = node.portal?.label ?? 'Open linked atlas';
    this.required('.node-id').textContent = `ID ${node.id.slice(-8).toUpperCase()}`;
    this.inspector.classList.add('is-visible');
    this.inspector.setAttribute('aria-hidden', 'false');
  }

  showComposer(active: boolean, clientX?: number, clientY?: number): void {
    this.composer.classList.toggle('is-visible', active);
    this.composer.setAttribute('aria-hidden', String(!active));
    if (!active) return;
    const width = 390;
    const x = clientX === undefined ? window.innerWidth * 0.5 - width * 0.5 : Math.min(window.innerWidth - width - 18, Math.max(18, clientX - 28));
    const y = clientY === undefined ? window.innerHeight * 0.42 : Math.min(window.innerHeight - 150, Math.max(90, clientY - 42));
    this.composer.style.left = `${x}px`;
    this.composer.style.top = `${y}px`;
    this.composerInput.value = '';
    requestAnimationFrame(() => this.composerInput.focus());
  }

  setSelectedLabel(text: string | null, x?: number, y?: number): void {
    if (!text) {
      this.label.classList.remove('is-visible');
      this.label.setAttribute('aria-hidden', 'true');
      return;
    }
    this.label.querySelector('span')!.textContent = text;
    if (x !== undefined && y !== undefined) this.label.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    this.label.classList.add('is-visible');
    this.label.setAttribute('aria-hidden', 'false');
  }

  toast(message: string): void {
    window.clearTimeout(this.toastTimer);
    this.toastElement.textContent = message;
    this.toastElement.classList.add('is-visible');
    this.toastTimer = window.setTimeout(() => this.toastElement.classList.remove('is-visible'), 2600);
  }

  private bind(): void {
    this.dimensionButtons.forEach((button) => button.addEventListener('click', () =>
      this.emit('dimension', button.dataset.dimension as ViewDimension)));
    this.skinButtons.forEach((button) => button.addEventListener('click', () =>
      this.emit('skin', button.dataset.skin as RenderSkinId)));
    this.sceneSelect.addEventListener('change', () => this.emit('scene', this.sceneSelect.value));
    this.required<HTMLButtonElement>('.share-view').addEventListener('click', () => this.emit('share', null));
    this.required<HTMLButtonElement>('.share-scope').addEventListener('click', () => this.emit('share', null));
    this.required<HTMLButtonElement>('.new-thought').addEventListener('click', () => this.showComposer(true));
    this.physicsButton.addEventListener('click', () => this.emit('physics-toggle', this.physicsButton.getAttribute('aria-pressed') !== 'true'));
    this.physicsPanel.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => button.addEventListener('click', () =>
      this.emit('physics-preset', button.dataset.preset as FunPhysicsPreset)));

    const search = this.required<HTMLFormElement>('.search');
    search.addEventListener('submit', (event) => {
      event.preventDefault();
      this.emit('search', { query: this.required<HTMLInputElement>('.search input').value });
    });
    this.composer.addEventListener('submit', (event) => {
      event.preventDefault();
      this.emit('add', { title: this.composerInput.value });
    });
    this.inspectorForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(this.inspectorForm);
      this.emit('save', {
        id: String(data.get('id') ?? ''),
        title: String(data.get('title') ?? ''),
        description: String(data.get('description') ?? ''),
        tags: String(data.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
        cluster: Number(data.get('cluster') ?? 0),
      });
    });
    this.required<HTMLButtonElement>('.link-node').addEventListener('click', () =>
      this.emit('link', { id: String(new FormData(this.inspectorForm).get('id') ?? '') }));
    this.required<HTMLButtonElement>('.share-node').addEventListener('click', () =>
      this.emit('share-node', { id: String(new FormData(this.inspectorForm).get('id') ?? '') }));
    this.portalButton.addEventListener('click', () => this.emit('portal', {
      scene: this.portalButton.dataset.scene,
      focus: this.portalButton.dataset.focus || undefined,
    }));
    this.required<HTMLButtonElement>('.delete-node').addEventListener('click', () =>
      this.emit('delete', { id: String(new FormData(this.inspectorForm).get('id') ?? '') }));
    this.required<HTMLButtonElement>('.close-inspector').addEventListener('click', () => this.showInspector(null));
    window.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.required<HTMLInputElement>('.search input').focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && this.inspector.classList.contains('is-visible')) {
        this.inspectorForm.requestSubmit();
      }
    });
  }

  private emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  private required<T extends Element = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`UI element is missing: ${selector}`);
    return element;
  }
}
