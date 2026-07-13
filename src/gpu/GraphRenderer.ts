import backgroundCode from '../shaders/background.wgsl?raw';
import edgesCode from '../shaders/edges.wgsl?raw';
import landmarksCode from '../shaders/landmarks.wgsl?raw';
import simpleCode from '../shaders/nodes-simple.wgsl?raw';
import luminousCode from '../shaders/nodes-luminous.wgsl?raw';
import dreamCode from '../shaders/nodes-dream.wgsl?raw';
import simulationCode from '../shaders/simulation.wgsl?raw';
import pickingCode from '../shaders/picking.wgsl?raw';
import { PALETTES } from '../config/palettes';
import type { AppSettings } from '../config/settings';
import type { CameraFrame } from '../core/camera';
import type { LayoutId, RenderSkinId } from '../core/types';
import { GraphBuffers } from './GraphBuffers';
import { GPUContext } from './GPUContext';

interface ShaderSet {
  background: string;
  edges: string;
  landmarks: string;
  simple: string;
  luminous: string;
  dream: string;
  simulation: string;
  picking: string;
}

let shaderSet: ShaderSet = {
  background: backgroundCode,
  edges: edgesCode,
  landmarks: landmarksCode,
  simple: simpleCode,
  luminous: luminousCode,
  dream: dreamCode,
  simulation: simulationCode,
  picking: pickingCode,
};

const shaderReloadListeners = new Set<(shaders: ShaderSet) => void>();

if (import.meta.hot) {
  import.meta.hot.accept([
    '../shaders/background.wgsl?raw',
    '../shaders/edges.wgsl?raw',
    '../shaders/landmarks.wgsl?raw',
    '../shaders/nodes-simple.wgsl?raw',
    '../shaders/nodes-luminous.wgsl?raw',
    '../shaders/nodes-dream.wgsl?raw',
    '../shaders/simulation.wgsl?raw',
    '../shaders/picking.wgsl?raw',
  ], (modules) => {
    if (modules.some((module) => !module)) return;
    shaderSet = {
      background: modules[0]!.default as string,
      edges: modules[1]!.default as string,
      landmarks: modules[2]!.default as string,
      simple: modules[3]!.default as string,
      luminous: modules[4]!.default as string,
      dream: modules[5]!.default as string,
      simulation: modules[6]!.default as string,
      picking: modules[7]!.default as string,
    };
    shaderReloadListeners.forEach((listener) => listener(shaderSet));
  });
}

const LAYOUT_INDEX: Record<LayoutId, number> = { force: 0, radial: 1, clusters: 2, lattice: 3 };

export interface RenderFrameInput {
  camera: CameraFrame;
  settings: AppSettings;
  elapsed: number;
  dt: number;
  runSimulation: boolean;
}

export class GraphRenderer {
  private readonly gpu: GPUContext;
  private readonly buffers: GraphBuffers;
  private backgroundPipeline!: GPURenderPipeline;
  private edgePipeline!: GPURenderPipeline;
  private landmarkPipeline!: GPURenderPipeline;
  private nodePipelines!: Record<RenderSkinId, GPURenderPipeline>;
  private dreamAuraPipeline!: GPURenderPipeline;
  private simulationPipeline!: GPUComputePipeline;
  private pickingPipeline!: GPUComputePipeline;
  private backgroundBindGroup!: GPUBindGroup;
  private edgeBindGroups!: [GPUBindGroup, GPUBindGroup];
  private landmarkBindGroups!: [GPUBindGroup, GPUBindGroup];
  private nodeBindGroups!: Record<RenderSkinId, [GPUBindGroup, GPUBindGroup]>;
  private dreamAuraBindGroups!: [GPUBindGroup, GPUBindGroup];
  private simulationBindGroups!: [GPUBindGroup, GPUBindGroup];
  private pickingBindGroups!: [GPUBindGroup, GPUBindGroup];
  private readonly pickResult: GPUBuffer;
  private pickPending = false;
  private readonly onShaderReload = (shaders: ShaderSet): void => {
    this.buildPipelines(shaders);
    this.buildBindGroups();
  };

  constructor(gpu: GPUContext, buffers: GraphBuffers) {
    this.gpu = gpu;
    this.buffers = buffers;
    this.pickResult = gpu.device.createBuffer({
      label: 'Pick result',
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    this.buildPipelines(shaderSet);
    this.buildBindGroups();
    shaderReloadListeners.add(this.onShaderReload);
  }

  render(input: RenderFrameInput): void {
    const { device } = this.gpu;
    this.writeSceneUniforms(input);
    if (input.runSimulation) this.writeSimulationUniforms(input);

    const encoder = device.createCommandEncoder({ label: 'HyperMind frame' });
    if (input.runSimulation) {
      const compute = encoder.beginComputePass({ label: 'Graph force layout' });
      compute.setPipeline(this.simulationPipeline);
      compute.setBindGroup(0, this.simulationBindGroups[this.buffers.current]);
      compute.dispatchWorkgroups(Math.ceil(this.buffers.nodeCount / 64));
      compute.end();
      this.buffers.swap();
    }

    const canvasView = this.gpu.context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      label: 'Graph render',
      colorAttachments: [{
        view: this.gpu.colorTexture!.createView(),
        resolveTarget: canvasView,
        clearValue: PALETTES[input.settings.palette].background,
        loadOp: 'clear',
        storeOp: 'discard',
      }],
      depthStencilAttachment: {
        view: this.gpu.depthTexture!.createView(),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    });

    pass.setPipeline(this.backgroundPipeline);
    pass.setBindGroup(0, this.backgroundBindGroup);
    pass.draw(3);

    pass.setPipeline(this.edgePipeline);
    pass.setBindGroup(0, this.edgeBindGroups[this.buffers.current]);
    pass.draw(6, this.buffers.edgeCount);

    pass.setPipeline(this.nodePipelines[input.settings.skin]);
    pass.setBindGroup(0, this.nodeBindGroups[input.settings.skin][this.buffers.current]);
    pass.draw(6, this.buffers.nodeCount);

    if (input.settings.skin === 'dream') {
      pass.setPipeline(this.dreamAuraPipeline);
      pass.setBindGroup(0, this.dreamAuraBindGroups[this.buffers.current]);
      pass.draw(6, this.buffers.nodeCount);
    }

    if (input.settings.showLandmarks) {
      pass.setPipeline(this.landmarkPipeline);
      pass.setBindGroup(0, this.landmarkBindGroups[this.buffers.current]);
      pass.draw(6, this.buffers.nodeCount);
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  async pick(pixelX: number, pixelY: number, extraRadius = 9): Promise<number | null> {
    if (this.pickPending) return null;
    this.pickPending = true;
    const { device } = this.gpu;
    const staging = device.createBuffer({
      label: 'Pick readback', size: 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    try {
      device.queue.writeBuffer(this.pickResult, 0, new Uint32Array([0xffffffff]));
      const pickUniforms = new Float32Array(16);
      pickUniforms.set([pixelX, pixelY, this.buffers.nodeCount, extraRadius]);
      device.queue.writeBuffer(this.buffers.simUniformBuffer, 0, pickUniforms);
      const encoder = device.createCommandEncoder({ label: 'Node pick query' });
      const pass = encoder.beginComputePass({ label: 'Node picking' });
      pass.setPipeline(this.pickingPipeline);
      pass.setBindGroup(0, this.pickingBindGroups[this.buffers.current]);
      pass.dispatchWorkgroups(Math.ceil(this.buffers.nodeCount / 64));
      pass.end();
      encoder.copyBufferToBuffer(this.pickResult, 0, staging, 0, 4);
      device.queue.submit([encoder.finish()]);
      await staging.mapAsync(GPUMapMode.READ);
      const packed = new Uint32Array(staging.getMappedRange())[0]!;
      staging.unmap();
      return packed === 0xffffffff ? null : packed & 0xffff;
    } finally {
      staging.destroy();
      this.pickPending = false;
    }
  }

  dispose(): void {
    shaderReloadListeners.delete(this.onShaderReload);
    this.pickResult.destroy();
  }

  private buildPipelines(shaders: ShaderSet): void {
    const { device, format, sampleCount } = this.gpu;
    const createModule = (label: string, code: string): GPUShaderModule => {
      const module = device.createShaderModule({ label, code });
      void module.getCompilationInfo().then((info) => {
        for (const message of info.messages) {
          if (message.type === 'info') continue;
          const detail = `${label}:${message.lineNum}:${message.linePos} ${message.message}`;
          if (message.type === 'error') console.error(detail);
          else console.warn(detail);
        }
      });
      return module;
    };
    const background = createModule('Background shader', shaders.background);
    const edges = createModule('Edge shader', shaders.edges);
    const landmarks = createModule('Landmark shader', shaders.landmarks);
    const simple = createModule('Paperlight nodes', shaders.simple);
    const luminous = createModule('Luminous nodes', shaders.luminous);
    const dream = createModule('Midnight core nodes', shaders.dream);
    const alphaBlend: GPUBlendState = {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    };
    const additiveBlend: GPUBlendState = {
      color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
      alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' },
    };
    const createRender = (
      label: string,
      module: GPUShaderModule,
      blend?: GPUBlendState,
      depthWrite = false,
      fragmentEntryPoint = 'fs_main',
      depthCompare: GPUCompareFunction = 'less-equal',
    ): GPURenderPipeline =>
      device.createRenderPipeline({
        label,
        layout: 'auto',
        vertex: { module, entryPoint: 'vs_main' },
        fragment: { module, entryPoint: fragmentEntryPoint, targets: [{ format, blend }] },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        multisample: { count: sampleCount },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: depthWrite, depthCompare },
      });

    this.backgroundPipeline = createRender('Infinite canvas background', background, undefined, false);
    this.edgePipeline = createRender('Graph links', edges, alphaBlend, false);
    this.landmarkPipeline = createRender('Debug landmarks', landmarks, alphaBlend, false);
    this.nodePipelines = {
      simple: createRender('Paperlight renderer', simple, alphaBlend, true),
      luminous: createRender('Luminous renderer', luminous, alphaBlend, true),
      dream: createRender('Midnight core renderer', dream, additiveBlend, false, 'fs_main', 'always'),
    };
    this.dreamAuraPipeline = createRender('Midnight aura renderer', dream, additiveBlend, false, 'fs_aura', 'always');
    this.simulationPipeline = device.createComputePipeline({
      label: 'GPU force simulation', layout: 'auto', compute: { module: createModule('Simulation shader', shaders.simulation), entryPoint: 'main' },
    });
    this.pickingPipeline = device.createComputePipeline({
      label: 'GPU node picking', layout: 'auto', compute: { module: createModule('Picking shader', shaders.picking), entryPoint: 'main' },
    });
  }

  private buildBindGroups(): void {
    const { device } = this.gpu;
    const sceneEntry: GPUBindGroupEntry = { binding: 0, resource: { buffer: this.buffers.sceneUniformBuffer } };
    this.backgroundBindGroup = device.createBindGroup({
      label: 'Background bindings', layout: this.backgroundPipeline.getBindGroupLayout(0), entries: [sceneEntry],
    });

    const createNodeGroups = (pipeline: GPURenderPipeline): [GPUBindGroup, GPUBindGroup] => [0, 1].map((index) =>
      device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [sceneEntry, { binding: 1, resource: { buffer: this.buffers.nodeBuffers[index]! } }],
      })) as [GPUBindGroup, GPUBindGroup];
    this.nodeBindGroups = {
      simple: createNodeGroups(this.nodePipelines.simple),
      luminous: createNodeGroups(this.nodePipelines.luminous),
      dream: createNodeGroups(this.nodePipelines.dream),
    };
    this.dreamAuraBindGroups = createNodeGroups(this.dreamAuraPipeline);
    this.landmarkBindGroups = createNodeGroups(this.landmarkPipeline);
    this.edgeBindGroups = [0, 1].map((index) => device.createBindGroup({
      layout: this.edgePipeline.getBindGroupLayout(0),
      entries: [sceneEntry, { binding: 1, resource: { buffer: this.buffers.nodeBuffers[index]! } }, { binding: 2, resource: { buffer: this.buffers.edgeBuffer } }],
    })) as [GPUBindGroup, GPUBindGroup];
    this.simulationBindGroups = [
      device.createBindGroup({
        layout: this.simulationPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.buffers.simUniformBuffer } },
          { binding: 1, resource: { buffer: this.buffers.nodeBuffers[0] } },
          { binding: 2, resource: { buffer: this.buffers.nodeBuffers[1] } },
          { binding: 3, resource: { buffer: this.buffers.edgeBuffer } },
        ],
      }),
      device.createBindGroup({
        layout: this.simulationPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.buffers.simUniformBuffer } },
          { binding: 1, resource: { buffer: this.buffers.nodeBuffers[1] } },
          { binding: 2, resource: { buffer: this.buffers.nodeBuffers[0] } },
          { binding: 3, resource: { buffer: this.buffers.edgeBuffer } },
        ],
      }),
    ];
    this.pickingBindGroups = [0, 1].map((index) => device.createBindGroup({
      layout: this.pickingPipeline.getBindGroupLayout(0),
      entries: [
        sceneEntry,
        { binding: 1, resource: { buffer: this.buffers.nodeBuffers[index]! } },
        { binding: 2, resource: { buffer: this.buffers.simUniformBuffer } },
        { binding: 3, resource: { buffer: this.pickResult } },
      ],
    })) as [GPUBindGroup, GPUBindGroup];
  }

  private writeSceneUniforms(input: RenderFrameInput): void {
    const scene = new Float32Array(64);
    scene.set(input.camera.viewProjection, 0);
    scene.set([...input.camera.right, 0], 16);
    scene.set([...input.camera.up, 0], 20);
    scene.set([...input.camera.position, 1], 24);
    scene.set([this.gpu.width, this.gpu.height, input.camera.zoom, devicePixelRatio], 28);
    scene.set([input.elapsed, input.dt, input.settings.dimension === '3d' ? 1 : 0, input.settings.skin === 'dream' ? 1 : 0], 32);
    scene.set([input.settings.animations ? 1 : 0, (input.settings.raySteps - 8) / 16, input.settings.nodeScale, 0.78 + input.settings.glow * 0.34], 36);
    const palette = PALETTES[input.settings.palette];
    scene.set([...palette.surface, input.settings.showGrid ? 1 : 0], 40);
    scene.set([...palette.accent, input.settings.edgeOpacity], 44);
    scene.set([input.settings.glow, input.settings.pulse, input.settings.nodeDensity, 0], 48);
    this.gpu.device.queue.writeBuffer(this.buffers.sceneUniformBuffer, 0, scene);
  }

  private writeSimulationUniforms(input: RenderFrameInput): void {
    const settings = input.settings;
    const uniforms = new Float32Array(16);
    const simulationDt = settings.animations ? input.dt * settings.simulationSpeed : 0;
    uniforms.set([simulationDt, this.buffers.nodeCount, settings.dimension === '2d' ? 2 : 3, LAYOUT_INDEX[settings.layout]], 0);
    uniforms.set([settings.repulsion, settings.spring, settings.damping * 3.5, settings.centering], 4);
    uniforms.set([settings.springLength / settings.nodeDensity, 16, 55, input.elapsed], 8);
    uniforms.set([this.buffers.edgeCount, 5, settings.clusterStrength, settings.springLength * 1.15], 12);
    this.gpu.device.queue.writeBuffer(this.buffers.simUniformBuffer, 0, uniforms);
  }
}
