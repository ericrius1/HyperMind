export interface GPUContextOptions {
  onDeviceLost?: (message: string) => void;
}

export class GPUContext {
  readonly adapter: GPUAdapter;
  readonly device: GPUDevice;
  readonly canvas: HTMLCanvasElement;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;
  readonly sampleCount = 4;
  colorTexture?: GPUTexture;
  depthTexture?: GPUTexture;
  width = 1;
  height = 1;

  private constructor(adapter: GPUAdapter, device: GPUDevice, canvas: HTMLCanvasElement, context: GPUCanvasContext, format: GPUTextureFormat) {
    this.adapter = adapter;
    this.device = device;
    this.canvas = canvas;
    this.context = context;
    this.format = format;
  }

  static async create(canvas: HTMLCanvasElement, options: GPUContextOptions = {}): Promise<GPUContext> {
    if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser. HyperMind requires a current WebGPU-capable browser.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No compatible WebGPU adapter was found.');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('The canvas could not create a WebGPU context.');
    const format = navigator.gpu.getPreferredCanvasFormat();
    const gpu = new GPUContext(adapter, device, canvas, context, format);
    context.configure({ device, format, alphaMode: 'opaque' });
    device.lost.then((info) => options.onDeviceLost?.(info.message || info.reason));
    device.addEventListener('uncapturederror', (event) => {
      console.error('Uncaptured WebGPU error', event.error.message);
    });
    return gpu;
  }

  resize(width: number, height: number): boolean {
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));
    if (width === this.width && height === this.height && this.colorTexture && this.depthTexture) return false;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    const retiredColor = this.colorTexture;
    const retiredDepth = this.depthTexture;
    this.colorTexture = this.device.createTexture({
      label: 'MSAA color',
      size: [width, height],
      sampleCount: this.sampleCount,
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTexture = this.device.createTexture({
      label: 'Graph depth',
      size: [width, height],
      sampleCount: this.sampleCount,
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    if (retiredColor || retiredDepth) {
      void this.device.queue.onSubmittedWorkDone().then(() => {
        retiredColor?.destroy();
        retiredDepth?.destroy();
      });
    }
    return true;
  }

  dispose(): void {
    this.colorTexture?.destroy();
    this.depthTexture?.destroy();
    this.device.destroy();
  }
}
