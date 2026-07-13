import Stats from 'stats.js';
import { Pane } from 'tweakpane';
import { SETTING_FIELDS, type SettingsStore } from '../config/settings';

export class Diagnostics {
  private readonly host: HTMLElement;
  private readonly pane: Pane;
  private readonly stats: Stats;
  private readonly frameTime: HTMLElement;
  private visible = true;

  constructor(root: HTMLElement, settings: SettingsStore) {
    this.host = document.createElement('aside');
    this.host.className = 'diagnostics';
    this.host.innerHTML = `<div class="stats-slot"></div><div class="frame-time"><b>0.00</b><span>MS / FRAME</span></div><div class="pane-slot"></div>`;
    (root.querySelector('.app-shell') ?? root).append(this.host);
    this.frameTime = this.host.querySelector('.frame-time')!;

    this.stats = new Stats();
    this.stats.showPanel(0);
    this.host.querySelector('.stats-slot')!.append(this.stats.dom);
    this.stats.dom.style.position = 'relative';
    this.stats.dom.style.left = '0';
    this.stats.dom.style.top = '0';

    this.pane = new Pane({ container: this.host.querySelector<HTMLElement>('.pane-slot')!, title: 'CONTROL DECK', expanded: true });
    type FolderLike = {
      addBinding(target: object, key: string, options: object): unknown;
    };
    type PaneLike = {
      addFolder(options: object): FolderLike;
      addButton(options: object): { on(type: string, callback: () => void): void };
      on(type: string, callback: () => void): void;
      refresh(): void;
    };
    const paneApi = this.pane as unknown as PaneLike;
    const folders = new Map<string, FolderLike>();
    for (const field of SETTING_FIELDS) {
      let folder = folders.get(field.folder);
      if (!folder) {
        folder = paneApi.addFolder({ title: field.folder, expanded: field.folder === 'View' || field.folder === 'Physics' });
        folders.set(field.folder, folder);
      }
      const options: Record<string, unknown> = { label: field.label };
      if (field.kind === 'number') Object.assign(options, { min: field.min, max: field.max, step: field.step });
      if (field.kind === 'options') options.options = field.options;
      folder.addBinding(settings.values, field.key, options);
    }
    paneApi.addButton({ title: 'Reset source defaults  [.]' }).on('click', () => settings.reset());
    paneApi.on('change', () => settings.changed());
  }

  beginFrame(): void {
    this.stats.begin();
  }

  endFrame(milliseconds: number): void {
    this.stats.end();
    this.frameTime.querySelector('b')!.textContent = milliseconds.toFixed(2);
  }

  refresh(): void {
    (this.pane as unknown as { refresh(): void }).refresh();
  }

  toggle(): void {
    this.visible = !this.visible;
    this.host.classList.toggle('is-hidden', !this.visible);
  }
}
