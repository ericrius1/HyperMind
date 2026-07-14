#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SAMPLE_RATE = 48_000;
const DURATION_SECONDS = 20;
const SAMPLE_COUNT = SAMPLE_RATE * DURATION_SECONDS;
const OUTPUT_PATH = resolve(
  process.argv[2] ?? '.data/cinematics/hypermind-original-score-20s.wav',
);

const left = new Float64Array(SAMPLE_COUNT);
const right = new Float64Array(SAMPLE_COUNT);

const TAU = Math.PI * 2;
const CUTS = [0, 3.6, 7, 9.5, 13, 17.2, 20];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function equalPowerPan(pan) {
  const theta = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(theta), Math.sin(theta)];
}

function envelope(time, duration, attack, release, curve = 1) {
  const attackGain = smoothstep(0, Math.max(attack, 1 / SAMPLE_RATE), time);
  const releaseGain = 1 - smoothstep(
    Math.max(0, duration - release),
    duration,
    time,
  );
  return Math.pow(Math.min(attackGain, releaseGain), curve);
}

function addTone({
  start,
  duration,
  frequency,
  amplitude,
  attack = 0.02,
  release = 0.2,
  pan = 0,
  phase = 0,
  detuneCents = 0,
  vibratoDepth = 0,
  vibratoRate = 0.15,
  harmonics = [[1, 1]],
  tremoloDepth = 0,
  tremoloRate = 0.2,
  envelopeCurve = 1,
}) {
  const first = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const last = Math.min(SAMPLE_COUNT, Math.ceil((start + duration) * SAMPLE_RATE));
  const [gainL, gainR] = equalPowerPan(pan);
  const detune = 2 ** (detuneCents / 1200);
  let oscillatorPhase = phase;

  for (let i = first; i < last; i += 1) {
    const localTime = i / SAMPLE_RATE - start;
    const env = envelope(localTime, duration, attack, release, envelopeCurve);
    const vibrato = 1 + vibratoDepth * Math.sin(TAU * vibratoRate * localTime + phase);
    oscillatorPhase += (TAU * frequency * detune * vibrato) / SAMPLE_RATE;
    const tremolo = 1 - tremoloDepth * 0.5
      + tremoloDepth * 0.5 * Math.sin(TAU * tremoloRate * localTime + phase * 0.73);

    let sample = 0;
    for (const [multiple, weight, harmonicPhase = 0] of harmonics) {
      sample += Math.sin(oscillatorPhase * multiple + harmonicPhase) * weight;
    }
    sample *= amplitude * env * tremolo;
    left[i] += sample * gainL;
    right[i] += sample * gainR;
  }
}

function addGliss({
  start,
  duration,
  startFrequency,
  endFrequency,
  amplitude,
  attack = 0.04,
  release = 0.25,
  pan = 0,
  phase = 0,
  curve = 1,
  harmonics = [[1, 1]],
  swell = false,
}) {
  const first = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const last = Math.min(SAMPLE_COUNT, Math.ceil((start + duration) * SAMPLE_RATE));
  const [gainL, gainR] = equalPowerPan(pan);
  let oscillatorPhase = phase;

  for (let i = first; i < last; i += 1) {
    const localTime = i / SAMPLE_RATE - start;
    const progress = clamp(localTime / duration, 0, 1);
    const curvedProgress = progress ** curve;
    const frequency = startFrequency * (endFrequency / startFrequency) ** curvedProgress;
    oscillatorPhase += (TAU * frequency) / SAMPLE_RATE;
    let env = envelope(localTime, duration, attack, release, 0.8);
    if (swell) env *= 0.18 + 0.82 * smoothstep(0, 0.92, progress);

    let sample = 0;
    for (const [multiple, weight, harmonicPhase = 0] of harmonics) {
      sample += Math.sin(oscillatorPhase * multiple + harmonicPhase) * weight;
    }
    sample *= amplitude * env;
    left[i] += sample * gainL;
    right[i] += sample * gainR;
  }
}

function addPadChord(start, end, frequencies, amplitude, phaseSeed) {
  const duration = end - start;
  frequencies.forEach((frequency, noteIndex) => {
    const center = (noteIndex / Math.max(1, frequencies.length - 1)) * 1.2 - 0.6;
    const noteAmplitude = amplitude * (1 - noteIndex * 0.045);
    const common = {
      start,
      duration,
      frequency,
      attack: Math.min(0.95, duration * 0.25),
      release: Math.min(1.35, duration * 0.32),
      harmonics: [[1, 1], [2, 0.17, 0.4], [3, 0.055, 1.1]],
      tremoloDepth: 0.12,
      tremoloRate: 0.09 + noteIndex * 0.013,
      vibratoDepth: 0.00045,
      vibratoRate: 0.11 + noteIndex * 0.009,
    };
    addTone({
      ...common,
      amplitude: noteAmplitude * 0.58,
      pan: clamp(center - 0.18, -0.88, 0.88),
      phase: phaseSeed + noteIndex * 0.79,
      detuneCents: -4.5 - noteIndex * 0.22,
    });
    addTone({
      ...common,
      amplitude: noteAmplitude * 0.54,
      pan: clamp(center + 0.18, -0.88, 0.88),
      phase: phaseSeed + noteIndex * 1.13 + 0.43,
      detuneCents: 4.1 + noteIndex * 0.19,
    });
  });
}

function addBell(start, frequency, amplitude, pan, duration = 1.35) {
  const partials = [
    [1, 1, 0, 1],
    [2.01, 0.39, 0.31, 1.55],
    [3.98, 0.13, 1.17, 2.25],
    [6.07, 0.055, 0.73, 3.1],
  ];
  for (const [multiple, weight, phase, decay] of partials) {
    const partialDuration = duration / Math.sqrt(decay);
    addTone({
      start,
      duration: partialDuration,
      frequency: frequency * multiple,
      amplitude: amplitude * weight,
      attack: 0.004 + multiple * 0.0007,
      release: partialDuration * 0.96,
      envelopeCurve: 0.72 + decay * 0.06,
      pan: clamp(pan + (multiple % 2 ? -0.06 : 0.07), -1, 1),
      phase,
      harmonics: [[1, 1]],
    });
  }
}

function addSoftPulse(start, frequency, amplitude, pan = 0, duration = 0.56) {
  addGliss({
    start,
    duration,
    startFrequency: frequency * 1.22,
    endFrequency: frequency * 0.94,
    amplitude,
    attack: 0.008,
    release: duration * 0.84,
    pan,
    curve: 0.55,
    harmonics: [[1, 1], [2, 0.2, 0.5], [3, 0.055, 1.2]],
  });
}

function addNoiseAtmosphere() {
  let state = 0x6d2b79f5;
  let lowL = 0;
  let lowR = 0;
  let previousL = 0;
  let previousR = 0;

  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const time = i / SAMPLE_RATE;
    const whiteL = random();
    const whiteR = random();
    lowL += 0.0085 * (whiteL - lowL);
    lowR += 0.0079 * (whiteR - lowR);
    const airL = whiteL - lowL * 0.72;
    const airR = whiteR - lowR * 0.72;
    previousL += 0.18 * (airL - previousL);
    previousR += 0.175 * (airR - previousR);

    const opening = 0.0018 * (0.62 + 0.38 * Math.sin(TAU * 0.047 * time + 0.2));
    const transition = smoothstep(9.5, 12.75, time)
      * (1 - smoothstep(12.92, 13.28, time))
      * 0.0105;
    const orbit = smoothstep(12.85, 13.35, time)
      * (1 - smoothstep(16.75, 17.25, time))
      * 0.0034;
    const hero = smoothstep(17.18, 17.35, time)
      * (1 - smoothstep(18.1, 19.7, time))
      * 0.0028;
    const amplitude = opening + transition + orbit + hero;
    left[i] += previousL * amplitude;
    right[i] += previousR * amplitude;
  }
}

// Harmonic bed, cross-faded exactly around the six editorial beats.
addPadChord(0, 4.45, [146.832, 220, 261.626, 329.628, 349.228], 0.028, 0.31);
addPadChord(3.25, 7.9, [116.541, 174.614, 220, 261.626, 293.665], 0.026, 1.27);
addPadChord(6.62, 10.55, [97.999, 146.832, 174.614, 220, 233.082], 0.027, 2.23);
addPadChord(9.12, 13.82, [110, 164.814, 195.998, 220, 293.665], 0.029, 3.19);
addPadChord(12.58, 17.75, [146.832, 174.614, 220, 233.082, 293.665], 0.031, 4.11);
addPadChord(16.82, 20, [73.416, 110, 146.832, 174.614, 329.628], 0.033, 5.07);

// Restrained sub foundation. The slow envelopes make every cut feel connected.
addTone({ start: 0, duration: 4.2, frequency: 73.416, amplitude: 0.052, attack: 0.7, release: 1.1, pan: -0.08, harmonics: [[1, 1], [2, 0.13]] });
addTone({ start: 3.3, duration: 4.2, frequency: 58.27, amplitude: 0.043, attack: 0.6, release: 1.0, pan: 0.08, harmonics: [[1, 1], [2, 0.11]] });
addTone({ start: 6.75, duration: 3.55, frequency: 48.999, amplitude: 0.047, attack: 0.55, release: 0.85, pan: -0.06, harmonics: [[1, 1], [2, 0.12]] });
addTone({ start: 9.25, duration: 4.15, frequency: 55, amplitude: 0.049, attack: 0.55, release: 0.9, pan: 0.07, harmonics: [[1, 1], [2, 0.1]] });
addTone({ start: 12.72, duration: 4.75, frequency: 73.416, amplitude: 0.052, attack: 0.38, release: 0.92, pan: -0.04, harmonics: [[1, 1], [2, 0.16]] });
addTone({ start: 16.96, duration: 3.04, frequency: 73.416, amplitude: 0.057, attack: 0.2, release: 1.55, pan: 0, harmonics: [[1, 1], [2, 0.12]] });

// Opening: sparse data-like glints floating above the network.
addBell(1.16, 587.33, 0.023, -0.52, 1.15);
addBell(2.24, 440, 0.018, 0.45, 1.06);
addBell(3.02, 659.255, 0.017, -0.16, 0.92);

// 3.6 s node-selection accent: a precise, elegant three-note prism.
addSoftPulse(3.6, 82.407, 0.055, -0.08, 0.62);
addBell(3.612, 440, 0.041, -0.38, 1.42);
addBell(3.676, 659.255, 0.029, 0.28, 1.23);
addBell(3.742, 880, 0.017, 0.58, 1.02);

// 7.0 s edit/save sequence: two tactile pulses and a small confirmation sparkle.
addSoftPulse(7, 73.416, 0.069, -0.18, 0.49);
addBell(7.012, 523.251, 0.021, -0.48, 0.54);
addSoftPulse(7.255, 82.407, 0.057, 0.16, 0.43);
addBell(7.268, 659.255, 0.017, 0.46, 0.48);
addSoftPulse(8.72, 97.999, 0.047, 0.08, 0.48);
addBell(8.735, 783.991, 0.021, 0.54, 0.86);

// 9.5–13.0 s morph: tonal lift plus an airy, accelerating ascent.
addGliss({ start: 9.5, duration: 3.5, startFrequency: 73.416, endFrequency: 293.665, amplitude: 0.034, attack: 0.16, release: 0.26, pan: -0.32, phase: 0.4, curve: 1.35, harmonics: [[1, 1], [2, 0.23, 0.3], [3, 0.07, 1.1]], swell: true });
addGliss({ start: 9.54, duration: 3.46, startFrequency: 110, endFrequency: 587.33, amplitude: 0.023, attack: 0.2, release: 0.22, pan: 0.38, phase: 1.2, curve: 1.5, harmonics: [[1, 1], [2, 0.16, 0.8]], swell: true });
for (let i = 0; i < 8; i += 1) {
  const progress = i / 7;
  const start = 9.78 + progress * 2.78;
  const notes = [293.665, 329.628, 440, 523.251, 587.33, 659.255, 783.991, 880];
  addBell(start, notes[i], 0.009 + progress * 0.011, -0.65 + progress * 1.3, 0.46);
}

// 13.0–17.2 s zero-g orbit: energized but light rhythmic propulsion.
const bassPattern = [73.416, 73.416, 58.27, 73.416, 48.999, 58.27, 73.416, 82.407, 73.416];
for (let i = 0; i < bassPattern.length; i += 1) {
  const start = 13 + i * 0.48;
  addSoftPulse(start, bassPattern[i], i === 0 ? 0.078 : 0.057, i % 2 ? 0.12 : -0.12, 0.42);
}
const arpeggio = [293.665, 349.228, 440, 523.251, 587.33, 440, 349.228, 523.251, 659.255, 587.33, 440, 783.991, 659.255, 523.251, 440, 587.33, 659.255];
for (let i = 0; i < arpeggio.length; i += 1) {
  const start = 13.055 + i * 0.24;
  const pan = Math.sin(i * 1.67) * 0.66;
  addBell(start, arpeggio[i], 0.012 + (i % 4 === 0 ? 0.005 : 0), pan, 0.42);
}

// 17.2 s hero resolve: grounded impact, wide chord bloom, then a clean tail.
addGliss({ start: 17.2, duration: 1.18, startFrequency: 92, endFrequency: 55, amplitude: 0.075, attack: 0.008, release: 0.94, pan: 0, phase: 0.7, curve: 0.48, harmonics: [[1, 1], [2, 0.16, 0.4]] });
addBell(17.218, 587.33, 0.042, -0.48, 1.78);
addBell(17.252, 880, 0.031, 0.46, 1.62);
addBell(17.31, 1318.51, 0.014, 0.1, 1.24);
addBell(18.34, 440, 0.016, -0.24, 1.28);

addNoiseAtmosphere();

// Transparent bus cleanup and deterministic mastering. The target RMS leaves
// headroom for platform encoding while staying close to a social-video -17 LUFS.
let hpStateL = 0;
let hpStateR = 0;
let previousInputL = 0;
let previousInputR = 0;
const highPassPole = 0.9982;
for (let i = 0; i < SAMPLE_COUNT; i += 1) {
  const inputL = left[i];
  const inputR = right[i];
  hpStateL = inputL - previousInputL + highPassPole * hpStateL;
  hpStateR = inputR - previousInputR + highPassPole * hpStateR;
  previousInputL = inputL;
  previousInputR = inputR;
  left[i] = hpStateL;
  right[i] = hpStateR;
}

// A broad 80 ms opening and 520 ms ending guarantee sample-safe boundaries.
for (let i = 0; i < SAMPLE_COUNT; i += 1) {
  const time = i / SAMPLE_RATE;
  const fadeIn = smoothstep(0, 0.08, time);
  const fadeOut = 1 - smoothstep(19.48, 20, time);
  const master = fadeIn * fadeOut;
  left[i] *= master;
  right[i] *= master;
}

function signalStats() {
  let peak = 0;
  let sumSquares = 0;
  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    sumSquares += left[i] ** 2 + right[i] ** 2;
  }
  return {
    peak,
    rms: Math.sqrt(sumSquares / (SAMPLE_COUNT * 2)),
  };
}

const beforeMaster = signalStats();
const targetRms = 10 ** (-18.2 / 20);
const targetPeak = 10 ** (-1.45 / 20);
let masterGain = targetRms / Math.max(beforeMaster.rms, 1e-12);
masterGain = Math.min(masterGain, targetPeak / Math.max(beforeMaster.peak, 1e-12));

for (let i = 0; i < SAMPLE_COUNT; i += 1) {
  left[i] *= masterGain;
  right[i] *= masterGain;
}

// Enforce exact zero-valued boundary samples even after quantization dithering.
left[0] = 0;
right[0] = 0;
left[SAMPLE_COUNT - 1] = 0;
right[SAMPLE_COUNT - 1] = 0;

const finalStats = signalStats();
const dataBytes = SAMPLE_COUNT * 2 * 2;
const wav = Buffer.allocUnsafe(44 + dataBytes);
wav.write('RIFF', 0, 4, 'ascii');
wav.writeUInt32LE(36 + dataBytes, 4);
wav.write('WAVE', 8, 4, 'ascii');
wav.write('fmt ', 12, 4, 'ascii');
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36, 4, 'ascii');
wav.writeUInt32LE(dataBytes, 40);

let ditherState = 0x9e3779b9;
const ditherRandom = () => {
  ditherState = Math.imul(ditherState ^ (ditherState >>> 15), 1 | ditherState);
  ditherState ^= ditherState + Math.imul(ditherState ^ (ditherState >>> 7), 61 | ditherState);
  return ((ditherState ^ (ditherState >>> 14)) >>> 0) / 0x100000000;
};

let offset = 44;
for (let i = 0; i < SAMPLE_COUNT; i += 1) {
  const boundary = i === 0 || i === SAMPLE_COUNT - 1;
  const ditherL = boundary ? 0 : (ditherRandom() - ditherRandom()) / 65536;
  const ditherR = boundary ? 0 : (ditherRandom() - ditherRandom()) / 65536;
  const pcmL = Math.round(clamp(left[i] + ditherL, -1, 1) * 32767);
  const pcmR = Math.round(clamp(right[i] + ditherR, -1, 1) * 32767);
  wav.writeInt16LE(pcmL, offset);
  wav.writeInt16LE(pcmR, offset + 2);
  offset += 4;
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, wav);

const manifestPath = resolve(dirname(OUTPUT_PATH), 'hypermind-score-manifest.json');
const manifest = {
  title: 'HyperMind — Neural Orbit',
  provenance: 'Original deterministic synthesis; no external or copyrighted source audio.',
  path: OUTPUT_PATH,
  sampleRate: SAMPLE_RATE,
  channels: 2,
  format: 'PCM signed 16-bit little-endian',
  durationSeconds: DURATION_SECONDS,
  sampleFrames: SAMPLE_COUNT,
  editCutsSeconds: CUTS,
  masterGain,
  peakLinear: finalStats.peak,
  peakDbfs: 20 * Math.log10(finalStats.peak),
  rmsLinear: finalStats.rms,
  rmsDbfs: 20 * Math.log10(finalStats.rms),
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({ ...manifest, manifestPath }, null, 2));
