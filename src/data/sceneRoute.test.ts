import { describe, expect, it } from 'vitest';
import { parseSceneRoute, sceneShareURL } from './sceneRoute';

describe('scene deep links', () => {
  it('parses node and subcluster scopes while rejecting unknown scenes', () => {
    expect(parseSceneRoute('https://example.test/?scene=francis&focus=node:fr-wolf', ['tutorial', 'francis'], 'tutorial')).toEqual({
      sceneId: 'francis', focus: { type: 'node', id: 'fr-wolf' },
    });
    expect(parseSceneRoute('https://example.test/?scene=missing&focus=subcluster:wolves', ['tutorial'], 'tutorial').sceneId).toBe('tutorial');
  });

  it('creates clean topic and focused share URLs', () => {
    expect(sceneShareURL('https://example.test/app?old=1#x', 'kabbalah', { type: 'topic' })).toBe('https://example.test/app?scene=kabbalah');
    expect(sceneShareURL('https://example.test/app', 'pilgrim', { type: 'subcluster', id: 'camino-routes' })).toContain('focus=subcluster%3Acamino-routes');
  });
});
