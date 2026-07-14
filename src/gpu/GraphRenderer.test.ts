import { describe, expect, it, vi } from 'vitest';
import { MAX_NODES } from '../core/types';
import {
  decodePickResult,
  GraphRenderer,
  PICK_INDEX_MASK,
  PICK_RESULT_NONE,
} from './GraphRenderer';

type PickExecutor = (pixelX: number, pixelY: number, extraRadius: number) => Promise<number | null>;

function rendererWithPickExecutor(executePick: PickExecutor): GraphRenderer {
  const renderer = Object.create(GraphRenderer.prototype) as GraphRenderer;
  Object.defineProperties(renderer, {
    pickQueue: { value: Promise.resolve(), writable: true },
    executePick: { value: executePick, writable: true },
  });
  return renderer;
}

describe('GraphRenderer picking', () => {
  it('serializes overlapping pick readbacks instead of dropping the later query', async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const events: string[] = [];
    const executePick = vi.fn<PickExecutor>()
      .mockImplementationOnce(async () => {
        events.push('first:start');
        await firstGate;
        events.push('first:end');
        return 7;
      })
      .mockImplementationOnce(async () => {
        events.push('second:start');
        return 11;
      });
    const renderer = rendererWithPickExecutor(executePick);

    const first = renderer.pick(10, 20, 4);
    const second = renderer.pick(30, 40, 6);
    await Promise.resolve();

    expect(executePick).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['first:start']);

    releaseFirst();
    await expect(first).resolves.toBe(7);
    await expect(second).resolves.toBe(11);
    expect(events).toEqual(['first:start', 'first:end', 'second:start']);
    expect(executePick).toHaveBeenNthCalledWith(2, 30, 40, 6);
  });

  it('continues the queue after an individual readback failure', async () => {
    const executePick = vi.fn<PickExecutor>()
      .mockRejectedValueOnce(new Error('device readback failed'))
      .mockResolvedValueOnce(23);
    const renderer = rendererWithPickExecutor(executePick);

    const failed = renderer.pick(1, 2);
    const recovered = renderer.pick(3, 4);

    await expect(failed).rejects.toThrow('device readback failed');
    await expect(recovered).resolves.toBe(23);
    expect(executePick).toHaveBeenCalledTimes(2);
  });

  it('decodes the low-byte node index and preserves the no-hit sentinel', () => {
    const packed = ((1234 << 19) | (321 << 8) | PICK_INDEX_MASK) >>> 0;
    expect(decodePickResult(packed)).toBe(PICK_INDEX_MASK);
    expect(decodePickResult(PICK_RESULT_NONE)).toBeNull();
    expect(PICK_INDEX_MASK + 1).toBe(MAX_NODES);
  });
});
