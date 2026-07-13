import type { Palette, PaletteId } from '../core/types';

export const PALETTES: Record<PaletteId, Palette> = {
  cobalt: {
    id: 'cobalt', label: 'Cobalt', background: [0.012, 0.025, 0.055, 1], surface: [0.05, 0.09, 0.17], accent: [0.25, 0.78, 1],
    clusters: [[0.22, 0.72, 1, 1], [0.32, 0.92, 0.74, 1], [0.63, 0.48, 1, 1], [1, 0.55, 0.72, 1], [0.96, 0.76, 0.32, 1]],
  },
  ember: {
    id: 'ember', label: 'Ember', background: [0.045, 0.018, 0.02, 1], surface: [0.16, 0.055, 0.04], accent: [1, 0.48, 0.2],
    clusters: [[1, 0.35, 0.18, 1], [1, 0.68, 0.2, 1], [0.94, 0.24, 0.48, 1], [0.72, 0.4, 1, 1], [1, 0.86, 0.5, 1]],
  },
  verdant: {
    id: 'verdant', label: 'Verdant', background: [0.008, 0.035, 0.028, 1], surface: [0.025, 0.13, 0.09], accent: [0.42, 1, 0.68],
    clusters: [[0.24, 0.96, 0.62, 1], [0.64, 0.96, 0.38, 1], [0.15, 0.78, 0.76, 1], [0.94, 0.78, 0.28, 1], [0.38, 0.68, 1, 1]],
  },
  violet: {
    id: 'violet', label: 'Violet', background: [0.026, 0.012, 0.06, 1], surface: [0.1, 0.045, 0.2], accent: [0.78, 0.5, 1],
    clusters: [[0.72, 0.42, 1, 1], [1, 0.4, 0.82, 1], [0.38, 0.7, 1, 1], [0.45, 1, 0.82, 1], [1, 0.72, 0.36, 1]],
  },
  mono: {
    id: 'mono', label: 'Monochrome', background: [0.018, 0.021, 0.026, 1], surface: [0.08, 0.09, 0.11], accent: [0.86, 0.9, 0.96],
    clusters: [[0.88, 0.92, 1, 1], [0.66, 0.72, 0.82, 1], [0.94, 0.82, 0.68, 1], [0.7, 0.82, 0.76, 1], [0.78, 0.7, 0.86, 1]],
  },
};
