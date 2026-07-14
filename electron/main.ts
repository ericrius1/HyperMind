import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

function applyCoopHeaders(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    headers['Cross-Origin-Opener-Policy'] = ['same-origin'];
    headers['Cross-Origin-Embedder-Policy'] = ['require-corp'];
    callback({ responseHeaders: headers });
  });
}

async function createWindow(): Promise<void> {
  applyCoopHeaders();

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#07101f',
    title: 'HyperMind',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:4173');
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  void createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
