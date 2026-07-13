export type SceneFocus =
  | { type: 'topic' }
  | { type: 'subcluster'; id: string }
  | { type: 'node'; id: string };

export interface SceneRoute {
  sceneId: string;
  focus: SceneFocus;
}

export function parseFocus(value: string | null): SceneFocus {
  if (!value || value === 'topic') return { type: 'topic' };
  const separator = value.indexOf(':');
  if (separator <= 0 || separator === value.length - 1) return { type: 'topic' };
  const type = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (type === 'node') return { type: 'node', id };
  if (type === 'subcluster') return { type: 'subcluster', id };
  return { type: 'topic' };
}

export function focusParam(focus: SceneFocus): string | null {
  return focus.type === 'topic' ? null : `${focus.type}:${focus.id}`;
}

export function parseSceneRoute(url: string, validSceneIds: readonly string[], fallbackSceneId: string): SceneRoute {
  const parsed = new URL(url);
  const requestedScene = parsed.searchParams.get('scene');
  return {
    sceneId: requestedScene && validSceneIds.includes(requestedScene) ? requestedScene : fallbackSceneId,
    focus: parseFocus(parsed.searchParams.get('focus')),
  };
}

export function sceneShareURL(baseURL: string, sceneId: string, focus: SceneFocus): string {
  const url = new URL(baseURL);
  url.search = '';
  url.searchParams.set('scene', sceneId);
  const focusValue = focusParam(focus);
  if (focusValue) url.searchParams.set('focus', focusValue);
  else url.searchParams.delete('focus');
  url.hash = '';
  return url.toString();
}
