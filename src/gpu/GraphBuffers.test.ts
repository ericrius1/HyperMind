import { describe, expect, it } from 'vitest';
import { EDGE_FLAG_CROSS_REGION, edgeRegionFlags } from './GraphBuffers';

describe('edge region flags', () => {
  it('keeps links inside one region unflagged', () => {
    expect(edgeRegionFlags(2, 2)).toBe(0);
  });

  it('marks cross-region links in either direction', () => {
    expect(edgeRegionFlags(1, 4)).toBe(EDGE_FLAG_CROSS_REGION);
    expect(edgeRegionFlags(4, 1)).toBe(EDGE_FLAG_CROSS_REGION);
  });
});
