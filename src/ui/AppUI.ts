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
  private readonly inspectorBackdrop: HTMLElement;
  private readonly inspectorForm: HTMLFormElement;
  private readonly tagEditor: HTMLElement;
  private readonly tagList: HTMLElement;
  private readonly tagInput: HTMLInputElement;
  private readonly tagValue: HTMLInputElement;
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
        <canvas id="graph-canvas" aria-label="Interactive HyperMind world map"></canvas>
        <div class="ambient-grain" aria-hidden="true"></div>

        <header class="topbar">
          <div class="brand-block">
            <a class="brand" href="#" aria-label="HyperMind home">
              <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
              <span><b>HYPER</b><strong>MIND</strong></span>
            </a>
            <span class="brand-rule"></span>
            <label class="scene-picker"><span>WORLDS</span><select aria-label="Choose a knowledge world"></select></label>
          </div>

          <form class="search" role="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
            <input type="search" placeholder="Seek a place, person, or idea…" aria-label="Search this world" />
            <kbd>⌘K</kbd>
          </form>

          <div class="top-actions">
            <a class="github-link" href="https://github.com/ericrius1/HyperMind" target="_blank" rel="noopener noreferrer" aria-label="Open HyperMind on GitHub">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85.004 1.71.12 2.51.34 1.9-1.32 2.74-1.05 2.74-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.48A10.05 10.05 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"/></svg>
              <span>GitHub</span>
            </a>
            <div class="atlas-menu">
              <button class="atlas-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Atlas save and transfer">Atlas</button>
              <div class="atlas-dropdown" role="menu" hidden>
                <button type="button" data-atlas="export-scene" role="menuitem">Export this world</button>
                <button type="button" data-atlas="export-all" role="menuitem">Export all worlds</button>
                <button type="button" data-atlas="import" role="menuitem">Import .hypermind</button>
              </div>
            </div>
            <button class="share-view" type="button" aria-label="Copy link to current view"><span>↗</span> Share view</button>
            <button class="new-thought" type="button"><span>＋</span> Plant a discovery</button>
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
            <kbd>P</kbd>
          </button>
        </nav>

        <aside class="keys-panel" aria-label="Keyboard shortcuts">
          <span class="eyebrow">KEYS</span>
          <dl>
            <div><dt><kbd>F</kbd></dt><dd>Focus selection</dd></div>
            <div><dt><kbd>P</kbd></dt><dd>Physics play</dd></div>
            <div><dt><kbd>C</kbd></dt><dd>2D / 3D</dd></div>
            <div><dt><kbd>Space</kbd></dt><dd>Open selected</dd></div>
            <div><dt><kbd>Esc</kbd></dt><dd>Clear / close</dd></div>
            <div><dt><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></dt><dd>Render skins</dd></div>
            <div><dt><kbd>/</kbd></dt><dd>Diagnostics</dd></div>
          </dl>
        </aside>

        <nav class="cluster-dock" aria-label="World trails and quests">
          <div class="cluster-intro"><span class="scene-kicker"></span><strong class="scene-title"></strong><p class="scene-invitation"></p></div>
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

        <div class="inspector-backdrop" aria-hidden="true"></div>
        <aside class="inspector" role="dialog" aria-modal="true" aria-label="Explore selected discovery" aria-hidden="true">
          <form class="inspector-form">
            <div class="inspector-head">
              <div><span class="eyebrow">DISCOVERY</span><span class="live-dot">FOUND</span></div>
              <button class="close-inspector" type="button" aria-label="Close discovery">×</button>
            </div>
            <input type="hidden" name="id" />
            <label class="field title-field"><span>Title</span><input name="title" autocomplete="off" maxlength="80" /></label>
            <label class="field"><span>Field notes</span><textarea name="description" rows="6" maxlength="1200"></textarea></label>
            <div class="field-row">
              <div class="field tag-field"><span id="tags-label">Tags</span><div class="tag-editor" aria-labelledby="tags-label">
                <div class="tag-list" aria-live="polite"></div>
                <input class="tag-input" type="text" placeholder="Add a tag…" autocomplete="off" aria-label="Add a tag" />
                <input class="tag-value" type="hidden" name="tags" />
              </div></div>
              <label class="field cluster-field"><span>Realm</span><select name="cluster">
                <option value="0">Systems</option><option value="1">Making</option><option value="2">Mind</option><option value="3">Technology</option><option value="4">Living world</option>
              </select></label>
            </div>
            <div class="node-meta"><span class="node-id"></span><span>Your marks stay in this world</span></div>
            <div class="inspector-share-row">
              <button class="share-node" type="button"><span>↗</span> Copy discovery link</button>
              <button class="portal-node" type="button"><span>→</span> <b>Cross into another world</b></button>
            </div>
            <div class="inspector-actions">
              <button class="save-node" type="submit">Keep discovery <kbd>⌘↵</kbd></button>
              <button class="link-node" type="button"><span>↗</span> Open a trail</button>
              <button class="delete-node" type="button" aria-label="Delete discovery">⌫</button>
            </div>
            <button class="exit-inspector" type="button">Return to the overmap <kbd>Esc</kbd></button>
          </form>
        </aside>

        <form class="composer" aria-hidden="true">
          <div class="composer-orb">＋</div>
          <div><span class="eyebrow">NEW DISCOVERY</span><input maxlength="80" placeholder="What did you find?" autocomplete="off" /></div>
          <button type="submit">Plant it <kbd>↵</kbd></button>
        </form>

        <div class="selected-label" aria-hidden="true"><i></i><div class="selected-label-card"><strong></strong><p></p></div></div>

        <footer class="statusbar">
          <div class="runtime-pill"><i></i><span class="runtime-value">WEBGPU · LIVE</span></div>
          <span class="count-value">0 discoveries · 0 trails</span>
          <span class="status-divider"></span>
          <span class="mode-hint"><b>CLICK</b> select · peek</span>
          <span class="mode-hint"><b>F</b> focus</span>
          <span class="mode-hint"><b>P</b> physics</span>
          <span class="mode-hint"><b>SPACE</b> open</span>
          <span class="mode-hint"><b>C</b> 2D/3D</span>
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
    this.inspectorBackdrop = this.required('.inspector-backdrop');
    this.inspectorForm = this.required<HTMLFormElement>('.inspector-form');
    this.tagEditor = this.required('.tag-editor');
    this.tagList = this.required('.tag-list');
    this.tagInput = this.required<HTMLInputElement>('.tag-input');
    this.tagValue = this.required<HTMLInputElement>('.tag-value');
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
    this.count.textContent = `${nodes} discoveries · ${edges} trails`;
  }

  setScenes(scenes: readonly GraphScene[], currentScene: GraphScene): void {
    this.sceneSelect.innerHTML = scenes.map((scene) => `<option value="${scene.id}">${scene.shortTitle}</option>`).join('');
    this.setScene(currentScene);
  }

  setScene(scene: GraphScene): void {
    this.sceneSelect.value = scene.id;
    this.required('.scene-kicker').textContent = scene.kicker;
    this.required('.scene-title').textContent = scene.title;
    this.required('.scene-invitation').textContent = scene.description;
    const clusterSelect = this.inspectorForm.elements.namedItem('cluster') as HTMLSelectElement;
    clusterSelect.innerHTML = scene.clusterLabels.map((label, index) => `<option value="${index}">${label}</option>`).join('');
  }

  setSubclusters(groups: readonly SceneSubcluster[], focus: SceneFocus): void {
    const scroll = this.required('.cluster-scroll');
    scroll.innerHTML = `<button type="button" data-focus="topic"><span>Whole world</span><small>WORLD MAP</small></button>${groups.map((group) =>
      `<button type="button" data-focus="${group.id}" title="${group.description}"><span>${group.label}</span><small>✦ QUEST TRAIL</small></button>`).join('')}`;
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

  isInspectorOpen(): boolean {
    return this.inspector.classList.contains('is-visible');
  }

  showInspector(node: GraphNode | null): void {
    if (!node) {
      this.inspector.classList.remove('is-visible');
      this.inspectorBackdrop.classList.remove('is-visible');
      this.inspector.setAttribute('aria-hidden', 'true');
      this.inspectorBackdrop.setAttribute('aria-hidden', 'true');
      return;
    }
    const field = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(name: string): T =>
      this.inspectorForm.elements.namedItem(name) as T;
    field<HTMLInputElement>('id').value = node.id;
    field<HTMLInputElement>('title').value = node.title;
    field<HTMLTextAreaElement>('description').value = node.description;
    this.renderTags(node.tags);
    field<HTMLSelectElement>('cluster').value = String(node.cluster);
    this.portalButton.classList.toggle('is-visible', Boolean(node.portal));
    this.portalButton.dataset.scene = node.portal?.scene ?? '';
    this.portalButton.dataset.focus = node.portal?.focus ?? '';
    this.portalButton.querySelector('b')!.textContent = node.portal?.label ?? 'Cross into another world';
    this.required('.node-id').textContent = `MARK ${node.id.slice(-8).toUpperCase()}`;
    this.inspectorBackdrop.classList.add('is-visible');
    this.inspectorBackdrop.setAttribute('aria-hidden', 'false');
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

  setSelectedLabel(title: string | null, blurb?: string | null, x?: number, y?: number): void {
    if (!title) {
      this.label.classList.remove('is-visible');
      this.label.classList.remove('is-flipped');
      this.label.setAttribute('aria-hidden', 'true');
      return;
    }
    this.label.querySelector('strong')!.textContent = title;
    const copy = this.label.querySelector('p')!;
    const text = blurb?.trim() ?? '';
    copy.textContent = text;
    copy.hidden = !text;
    if (x !== undefined && y !== undefined) {
      const margin = 12;
      const connectorWidth = 24;
      const statusbarClearance = 64;
      const card = this.label.querySelector<HTMLElement>('.selected-label-card')!;
      const totalWidth = connectorWidth + card.offsetWidth;
      const flip = x + totalWidth + margin > window.innerWidth && x - totalWidth >= margin;
      this.label.classList.toggle('is-flipped', flip);
      const unclampedX = flip ? x - totalWidth : x;
      const maxX = Math.max(margin, window.innerWidth - totalWidth - margin);
      const positionX = Math.min(maxX, Math.max(margin, unclampedX));
      const minY = margin + 26;
      const maxY = Math.max(minY, window.innerHeight - statusbarClearance - card.offsetHeight + 26);
      const positionY = Math.min(maxY, Math.max(minY, y));
      this.label.style.transform = `translate3d(${positionX}px, ${positionY}px, 0)`;
    }
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
    this.bindAtlasMenu();
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
      this.commitTagInput();
      const data = new FormData(this.inspectorForm);
      this.emit('save', {
        id: String(data.get('id') ?? ''),
        title: String(data.get('title') ?? ''),
        description: String(data.get('description') ?? ''),
        tags: String(data.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
        cluster: Number(data.get('cluster') ?? 0),
      });
    });
    this.tagInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        this.commitTagInput();
      } else if (event.key === 'Backspace' && !this.tagInput.value) {
        const tags = this.currentTags();
        if (tags.length > 0) this.renderTags(tags.slice(0, -1));
      }
    });
    this.tagInput.addEventListener('input', () => {
      if (this.tagInput.value.includes(',')) this.commitTagInput();
    });
    this.tagInput.addEventListener('blur', () => this.commitTagInput());
    this.tagEditor.addEventListener('click', (event) => {
      const target = event.target as Element;
      const removeButton = target.closest<HTMLButtonElement>('[data-remove-tag]');
      if (removeButton) {
        event.preventDefault();
        event.stopPropagation();
        const removeIndex = Number(removeButton.dataset.removeTag);
        this.renderTags(this.currentTags().filter((_, index) => index !== removeIndex));
      } else if (!target.closest('.tag-chip')) {
        this.tagInput.focus();
      }
    });
    this.tagEditor.addEventListener('dblclick', (event) => {
      const chip = (event.target as Element).closest<HTMLElement>('[data-tag-index]');
      if (!chip || (event.target as Element).closest('[data-remove-tag]')) return;
      event.preventDefault();
      event.stopPropagation();
      this.startTagEdit(Number(chip.dataset.tagIndex));
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
    const closeInspector = (): void => {
      this.showInspector(null);
      this.emit('inspector-close', null);
    };
    this.required<HTMLButtonElement>('.close-inspector').addEventListener('click', closeInspector);
    this.required<HTMLButtonElement>('.exit-inspector').addEventListener('click', closeInspector);
    this.inspectorBackdrop.addEventListener('click', closeInspector);
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

  private bindAtlasMenu(): void {
    const toggle = this.required<HTMLButtonElement>('.atlas-toggle');
    const menu = this.required<HTMLElement>('.atlas-dropdown');
    const setOpen = (open: boolean): void => {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(menu.hasAttribute('hidden'));
    });
    menu.querySelectorAll<HTMLButtonElement>('[data-atlas]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.atlas;
        setOpen(false);
        if (action === 'export-scene') this.emit('export', 'scene');
        else if (action === 'export-all') this.emit('export', 'all');
        else if (action === 'import') this.emit('import', null);
      });
    });
    window.addEventListener('pointerdown', (event) => {
      if (!menu.hidden && !(event.target instanceof Node && this.required('.atlas-menu').contains(event.target))) {
        setOpen(false);
      }
    });
  }

  private emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  private currentTags(): string[] {
    return this.tagValue.value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  private commitTagInput(): void {
    const incoming = this.tagInput.value.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (incoming.length === 0) return;
    const tags = [...this.currentTags()];
    for (const tag of incoming) {
      if (!tags.some((existing) => existing.localeCompare(tag, undefined, { sensitivity: 'accent' }) === 0)) tags.push(tag);
    }
    this.tagInput.value = '';
    this.renderTags(tags);
  }

  private renderTags(tags: readonly string[]): void {
    this.tagValue.value = tags.join(', ');
    this.tagList.replaceChildren(...tags.map((tag, index) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.dataset.tagIndex = String(index);
      chip.title = 'Double-click to edit';
      const label = document.createElement('span');
      label.textContent = tag;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.removeTag = String(index);
      remove.setAttribute('aria-label', `Remove ${tag} tag`);
      remove.textContent = '×';
      chip.append(label, remove);
      return chip;
    }));
  }

  private startTagEdit(index: number): void {
    const tags = this.currentTags();
    const original = tags[index];
    const chip = this.tagList.querySelector<HTMLElement>(`[data-tag-index="${index}"]`);
    if (!original || !chip || chip.classList.contains('is-editing')) return;

    const input = document.createElement('input');
    input.className = 'tag-edit-input';
    input.value = original;
    input.setAttribute('aria-label', `Edit ${original} tag`);
    input.style.width = `${Math.max(100, Math.min(300, original.length * 12 + 40))}px`;
    chip.classList.add('is-editing');
    chip.removeAttribute('title');
    chip.replaceChildren(input);

    let finished = false;
    const finish = (commit: boolean): void => {
      if (finished) return;
      finished = true;
      const edited = input.value.trim();
      const duplicate = tags.some((tag, tagIndex) =>
        tagIndex !== index && tag.localeCompare(edited, undefined, { sensitivity: 'accent' }) === 0);
      if (commit && edited && !duplicate) tags[index] = edited;
      this.renderTags(tags);
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
    input.focus();
    input.select();
  }

  private required<T extends Element = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`UI element is missing: ${selector}`);
    return element;
  }
}
