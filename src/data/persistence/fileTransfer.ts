import {
  HYPERMIND_FORMAT,
  isHyperMindBundle,
  type HyperMindBundle,
} from './types';

const FILE_EXTENSION = '.hypermind';
const ACCEPT = {
  'application/json': [FILE_EXTENSION],
  'application/hypermind+json': [FILE_EXTENSION],
};

export function encodeBundle(bundle: HyperMindBundle): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(bundle, null, 2)}\n`);
}

export function decodeBundle(bytes: Uint8Array): HyperMindBundle {
  const text = new TextDecoder().decode(bytes);
  const parsed: unknown = JSON.parse(text);
  if (!isHyperMindBundle(parsed)) {
    throw new Error('This file is not a HyperMind export.');
  }
  return parsed;
}

export async function saveBundleToDisk(bundle: HyperMindBundle, suggestedName = 'atlas.hypermind'): Promise<boolean> {
  const bytes = encodeBundle(bundle);
  const filename = suggestedName.endsWith(FILE_EXTENSION) ? suggestedName : `${suggestedName}${FILE_EXTENSION}`;
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'application/json',
  });

  const picker = (window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle>;
  }).showSaveFilePicker;

  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: 'HyperMind atlas', accept: ACCEPT }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      throw error;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function openBundleFromDisk(): Promise<HyperMindBundle | null> {
  const picker = (window as Window & {
    showOpenFilePicker?: (options: {
      multiple?: boolean;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle[]>;
  }).showOpenFilePicker;

  if (typeof picker === 'function') {
    try {
      const [handle] = await picker({
        multiple: false,
        types: [{ description: 'HyperMind atlas', accept: ACCEPT }],
      });
      if (!handle) return null;
      const file = await handle.getFile();
      return decodeBundle(new Uint8Array(await file.arrayBuffer()));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return null;
      throw error;
    }
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${FILE_EXTENSION},application/json`;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file.arrayBuffer()
        .then((buffer) => resolve(decodeBundle(new Uint8Array(buffer))))
        .catch(reject);
    });
    input.click();
  });
}

export function defaultExportName(sceneId?: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return sceneId ? `hypermind-${sceneId}-${stamp}${FILE_EXTENSION}` : `hypermind-all-${stamp}${FILE_EXTENSION}`;
}

export { FILE_EXTENSION, HYPERMIND_FORMAT };
