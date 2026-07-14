#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEFAULT_URL = 'http://127.0.0.1:4175/?scene=agent-learning&capture=1';

function usage() {
  return `Usage: node scripts/cinematic/capture-cinematic.mjs [options]

Options:
  --mode probes|render       Render selected probe PNGs or the complete MP4 (default: probes)
  --url URL                  Running HyperMind URL (default: ${DEFAULT_URL})
  --fps NUMBER               Fixed capture frame rate (default: 30)
  --frames NUMBER            Exact frame count (default: 600)
  --width NUMBER             CSS viewport width (default: 1920)
  --height NUMBER            CSS viewport height (default: 1080)
  --dpr NUMBER               Device pixel ratio (default: 1.3333333333)
  --output PATH              Silent MP4 output for render mode
  --probe-dir PATH           Probe PNG directory
  --chrome PATH              Chrome executable
  --help                     Show this help
`;
}

function parseArgs(argv) {
  const values = {
    mode: 'probes',
    url: DEFAULT_URL,
    fps: 30,
    frames: 600,
    width: 1920,
    height: 1080,
    dpr: 4 / 3,
    output: '.data/cinematics/hypermind-film-silent-1440p30.mp4',
    probeDir: '.data/cinematics/probes',
    chrome: DEFAULT_CHROME,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (raw === '--help') {
      process.stdout.write(usage());
      process.exit(0);
    }
    if (!raw.startsWith('--')) throw new Error(`Unexpected argument: ${raw}`);
    const separator = raw.indexOf('=');
    const key = raw.slice(2, separator >= 0 ? separator : undefined);
    const incoming = separator >= 0 ? raw.slice(separator + 1) : argv[++index];
    if (incoming === undefined) throw new Error(`Missing value for --${key}`);
    if (key === 'mode') values.mode = incoming;
    else if (key === 'url') values.url = incoming;
    else if (key === 'fps') values.fps = Number(incoming);
    else if (key === 'frames') values.frames = Number(incoming);
    else if (key === 'width') values.width = Number(incoming);
    else if (key === 'height') values.height = Number(incoming);
    else if (key === 'dpr') values.dpr = Number(incoming);
    else if (key === 'output') values.output = incoming;
    else if (key === 'probe-dir') values.probeDir = incoming;
    else if (key === 'chrome') values.chrome = incoming;
    else throw new Error(`Unknown option: --${key}`);
  }
  if (!['probes', 'render'].includes(values.mode)) throw new Error('--mode must be probes or render');
  for (const key of ['fps', 'frames', 'width', 'height', 'dpr']) {
    if (!Number.isFinite(values[key]) || values[key] <= 0) throw new Error(`--${key} must be positive`);
  }
  if (!Number.isInteger(values.frames) || !Number.isInteger(values.width) || !Number.isInteger(values.height)) {
    throw new Error('--frames, --width, and --height must be integers');
  }
  values.output = path.resolve(PROJECT_ROOT, values.output);
  values.probeDir = path.resolve(PROJECT_ROOT, values.probeDir);
  return values;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function waitForOpenStream(stream) {
  if (typeof stream.fd === 'number') return Promise.resolve();
  return new Promise((resolve, reject) => {
    stream.once('open', resolve);
    stream.once('error', reject);
  });
}

async function waitFor(label, callback, timeoutMs = 60_000, intervalMs = 100) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await callback();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

class CDPClient {
  constructor(url) {
    this.url = url;
    this.sequence = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out connecting to ${url}`)), 15_000);
      this.socket.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.socket.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to connect to ${url}`));
      }, { once: true });
    });
    this.socket.addEventListener('message', (event) => this.onMessage(event));
    this.socket.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('Chrome DevTools connection closed'));
      this.pending.clear();
    });
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) ?? new Set();
    callbacks.add(callback);
    this.listeners.set(method, callbacks);
    return () => callbacks.delete(callback);
  }

  async send(method, params = {}, timeoutMs = 120_000) {
    await this.ready;
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }

  onMessage(event) {
    const text = typeof event.data === 'string'
      ? event.data
      : Buffer.from(event.data).toString('utf8');
    const message = JSON.parse(text);
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${message.error.message}${message.error.data ? `: ${message.error.data}` : ''}`));
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    for (const callback of this.listeners.get(message.method) ?? []) callback(message.params);
  }
}

function captureURL(raw) {
  const parsed = new URL(raw);
  if (!parsed.searchParams.has('scene')) parsed.searchParams.set('scene', 'agent-learning');
  parsed.searchParams.set('capture', '1');
  return parsed.toString();
}

async function launchChrome(config, dataDir) {
  const profileDir = path.join(dataDir, 'chrome-profile');
  const chromeLog = path.join(dataDir, 'chrome.log');
  await rm(profileDir, { recursive: true, force: true });
  await mkdir(profileDir, { recursive: true });
  const logStream = createWriteStream(chromeLog, { flags: 'w' });
  await waitForOpenStream(logStream);
  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-gpu-sandbox',
    '--enable-unsafe-webgpu',
    '--ignore-gpu-blocklist',
    '--use-angle=metal',
    '--force-color-profile=srgb',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    '--mute-audio',
    `--window-size=${config.width},${config.height}`,
    captureURL(config.url),
  ];
  const child = spawn(config.chrome, args, { stdio: ['ignore', logStream, logStream] });
  child.once('error', (error) => logStream.destroy(error));
  const activePortFile = path.join(profileDir, 'DevToolsActivePort');
  const activePort = await waitFor('Chrome DevTools port', async () => {
    const content = await readFile(activePortFile, 'utf8');
    const port = Number(content.split(/\r?\n/, 1)[0]);
    return Number.isFinite(port) && port > 0 ? port : null;
  }, 30_000);
  const target = await waitFor('Chrome page target', async () => {
    const response = await fetch(`http://127.0.0.1:${activePort}/json/list`);
    if (!response.ok) return null;
    const targets = await response.json();
    return targets.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl)
      ?? null;
  }, 30_000);
  return { child, client: new CDPClient(target.webSocketDebuggerUrl), profileDir, chromeLog, logStream };
}

async function stopChrome(runtime) {
  runtime.client?.close();
  if (runtime.child && runtime.child.exitCode === null) {
    runtime.child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => runtime.child.once('exit', resolve)),
      delay(3_000),
    ]);
    if (runtime.child.exitCode === null) runtime.child.kill('SIGKILL');
  }
  runtime.logStream?.end();
  await rm(runtime.profileDir, { recursive: true, force: true });
}

async function evaluate(client, expression, timeoutMs = 120_000) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  }, timeoutMs);
  if (response.exceptionDetails) {
    const description = response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text
      ?? 'Unknown page exception';
    throw new Error(description);
  }
  return response.result?.value;
}

async function surfaceScreenshot(client) {
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: true,
  });
  return result.data;
}

async function screenshot(client) {
  await evaluate(client, `window.__hypermindDirector.setCaptureLayer('canvas')`, 180_000);
  try {
    const canvasPng = await surfaceScreenshot(client);
    const dataUrl = `data:image/png;base64,${canvasPng}`;
    await evaluate(
      client,
      `window.__hypermindDirector.setCaptureLayer('composite', ${JSON.stringify(dataUrl)})`,
      180_000,
    );
    const compositePng = await surfaceScreenshot(client);
    return Buffer.from(compositePng, 'base64');
  } finally {
    await evaluate(client, `window.__hypermindDirector.setCaptureLayer('live')`, 180_000);
  }
}

function pngDimensions(bytes) {
  const signature = '89504e470d0a1a0a';
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== signature) {
    throw new Error('Chrome returned an invalid PNG screenshot');
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function writeProbe(config, bytes, outputPath) {
  const expectedWidth = Math.round(config.width * config.dpr);
  const expectedHeight = Math.round(config.height * config.dpr);
  const dimensions = pngDimensions(bytes);
  if (dimensions.width === expectedWidth && dimensions.height === expectedHeight) {
    await writeFile(outputPath, bytes);
  } else {
    if (dimensions.width < expectedWidth || dimensions.height < expectedHeight) {
      throw new Error(`Screenshot surface ${dimensions.width}x${dimensions.height} is smaller than ${expectedWidth}x${expectedHeight}`);
    }
    const surfacePath = `${outputPath}.surface.png`;
    await writeFile(surfacePath, bytes);
    try {
      const result = spawnSync('ffmpeg', [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', surfacePath,
        '-vf', `crop=${expectedWidth}:${expectedHeight}:0:0`,
        '-frames:v', '1', outputPath,
      ]);
      if (result.status !== 0) {
        throw new Error(`Failed to crop probe ${path.basename(outputPath)}: ${result.stderr?.toString().trim()}`);
      }
    } finally {
      await rm(surfacePath, { force: true });
    }
  }
  const saved = await stat(outputPath);
  return { ...dimensions, bytes: saved.size };
}

async function startEncoder(config, dataDir) {
  const ffmpegLog = path.join(dataDir, 'ffmpeg-capture.log');
  const logStream = createWriteStream(ffmpegLog, { flags: 'w' });
  await waitForOpenStream(logStream);
  const gop = Math.round(config.fps * 2);
  const outputWidth = Math.round(config.width * config.dpr);
  const outputHeight = Math.round(config.height * config.dpr);
  const child = spawn('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'warning',
    '-f', 'image2pipe', '-framerate', String(config.fps), '-vcodec', 'png', '-i', 'pipe:0',
    '-an', '-vf', `crop=${outputWidth}:${outputHeight}:0:0,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '10',
    '-profile:v', 'high', '-level:v', '5.1',
    '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0', '-flags', '+cgop',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart',
    config.output,
  ], { stdio: ['pipe', 'ignore', logStream] });
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      logStream.end();
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code ?? signal}; see ${ffmpegLog}`));
    });
  });
  return { child, completion, ffmpegLog };
}

async function writeFrame(stream, bytes) {
  if (stream.write(bytes)) return;
  await new Promise((resolve, reject) => {
    const onDrain = () => {
      stream.off('error', onError);
      resolve();
    };
    const onError = (error) => {
      stream.off('drain', onDrain);
      reject(error);
    };
    stream.once('drain', onDrain);
    stream.once('error', onError);
  });
}

function sourceRevision() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const dataDir = path.join(PROJECT_ROOT, '.data', 'cinematics');
  await mkdir(dataDir, { recursive: true });
  await rm(config.probeDir, { recursive: true, force: true });
  await mkdir(config.probeDir, { recursive: true });
  if (config.mode === 'render') {
    await mkdir(path.dirname(config.output), { recursive: true });
    await rm(config.output, { force: true });
  }

  const consoleIssues = [];
  const frameRecords = [];
  let captureSurfaceSize = null;
  let runtime;
  let encoder;
  try {
    runtime = await launchChrome(config, dataDir);
    const client = runtime.client;
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Log.enable'),
      client.send('Network.enable'),
    ]);
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      consoleIssues.push({ type: 'exception', text: exceptionDetails.exception?.description ?? exceptionDetails.text });
    });
    client.on('Runtime.consoleAPICalled', ({ type, args }) => {
      if (!['error', 'assert'].includes(type)) return;
      consoleIssues.push({ type: `console.${type}`, text: args.map((arg) => arg.value ?? arg.description).join(' ') });
    });
    client.on('Log.entryAdded', ({ entry }) => {
      if (entry.level === 'error') {
        consoleIssues.push({ type: 'log.error', text: entry.text, source: entry.source, url: entry.url });
      }
    });

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: config.width,
      height: config.height,
      deviceScaleFactor: config.dpr,
      mobile: false,
      screenWidth: config.width,
      screenHeight: config.height,
      screenOrientation: { type: 'landscapePrimary', angle: 0 },
    });
    await client.send('Page.navigate', { url: captureURL(config.url) });
    await waitFor('HyperMind capture promise', async () => {
      try {
        return await evaluate(client, `typeof window.__hypermindReady === 'object'`);
      } catch {
        return false;
      }
    }, 90_000, 200);
    const readiness = await evaluate(client, `(async () => {
      await window.__hypermindReady;
      await document.fonts.ready;
      return {
        webgpu: Boolean(navigator.gpu),
        isolated: crossOriginIsolated,
        loadingHidden: document.querySelector('.loading-screen')?.classList.contains('is-hidden') ?? false,
        manrope: document.fonts.check('20px Manrope'),
        dmMono: document.fonts.check('16px "DM Mono"'),
        dimensions: [innerWidth, innerHeight, devicePixelRatio],
      };
    })()`);
    if (!readiness.webgpu || !readiness.loadingHidden) throw new Error(`App did not become capture-ready: ${JSON.stringify(readiness)}`);
    if (!readiness.manrope || !readiness.dmMono) throw new Error(`Capture fonts failed to load: ${JSON.stringify(readiness)}`);

    const directorSource = await readFile(path.join(SCRIPT_DIR, 'page-director.js'), 'utf8');
    await evaluate(client, directorSource);
    const prepared = await evaluate(client, `window.__hypermindDirector.prepare(${JSON.stringify(config)})`, 180_000);
    const probeFrames = new Set(prepared.probeFrames);
    if (prepared.pixelWidth !== Math.round(config.width * config.dpr)
      || prepared.pixelHeight !== Math.round(config.height * config.dpr)) {
      throw new Error(`Unexpected render size: ${prepared.pixelWidth}x${prepared.pixelHeight}`);
    }

    if (config.mode === 'render') encoder = await startEncoder(config, dataDir);
    const startedAt = Date.now();
    for (let frame = 0; frame < config.frames; frame += 1) {
      const record = await evaluate(client, `window.__hypermindDirector.renderFrame(${frame})`, 180_000);
      const needsProbe = probeFrames.has(frame);
      if (config.mode === 'render' || needsProbe) {
        const png = await screenshot(client);
        const dimensions = pngDimensions(png);
        if (!captureSurfaceSize) captureSurfaceSize = dimensions;
        else if (dimensions.width !== captureSurfaceSize.width || dimensions.height !== captureSurfaceSize.height) {
          throw new Error(`Screenshot surface changed from ${captureSurfaceSize.width}x${captureSurfaceSize.height} to ${dimensions.width}x${dimensions.height}`);
        }
        if (config.mode === 'render') await writeFrame(encoder.child.stdin, png);
        if (needsProbe) {
          const filename = `frame-${String(frame).padStart(6, '0')}-${record.shot}.png`;
          const probe = await writeProbe(config, png, path.join(config.probeDir, filename));
          frameRecords.push({ ...record, file: filename, bytes: probe.bytes });
        }
      }
      if (frame === 0 || frame === config.frames - 1 || (frame + 1) % Math.max(1, Math.round(config.fps)) === 0) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        process.stdout.write(`[${config.mode}] ${frame + 1}/${config.frames} frames · ${record.shot} · ${elapsed}s\n`);
      }
    }
    if (encoder) {
      encoder.child.stdin.end();
      await encoder.completion;
    }

    const chromeVersion = spawnSync(config.chrome, ['--version'], { encoding: 'utf8' }).stdout?.trim() ?? 'unknown';
    const manifest = {
      createdAt: new Date().toISOString(),
      mode: config.mode,
      url: captureURL(config.url),
      sourceRevision: sourceRevision(),
      node: process.version,
      chrome: chromeVersion,
      config: {
        fps: config.fps,
        frames: config.frames,
        durationSeconds: config.frames / config.fps,
        cssSize: [config.width, config.height],
        dpr: config.dpr,
        pixelSize: [prepared.pixelWidth, prepared.pixelHeight],
      },
      readiness,
      prepared,
      captureSurfaceSize,
      probes: frameRecords,
      output: config.mode === 'render' ? config.output : null,
      consoleIssues,
    };
    await writeFile(path.join(dataDir, `manifest-${config.mode}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
    if (consoleIssues.length > 0) {
      process.stderr.write(`${JSON.stringify(consoleIssues, null, 2)}\n`);
      throw new Error(`Capture produced ${consoleIssues.length} browser errors; see manifest`);
    }
    process.stdout.write(`Capture ${config.mode} complete.\n`);
  } finally {
    if (encoder?.child && encoder.child.exitCode === null) encoder.child.kill('SIGTERM');
    if (runtime) await stopChrome(runtime);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
