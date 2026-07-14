import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';

const coopHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig(({ mode }) => {
  const withDesktop = mode === 'desktop';

  return {
    base: './',
    server: {
      host: '127.0.0.1',
      port: 4173,
      headers: coopHeaders,
    },
    preview: {
      headers: coopHeaders,
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
    optimizeDeps: {
      exclude: ['@sqlite.org/sqlite-wasm'],
    },
    plugins: withDesktop
      ? [
          electron({
            main: {
              entry: 'electron/main.ts',
              vite: {
                build: {
                  outDir: 'dist-electron',
                },
              },
            },
          }),
        ]
      : [],
  };
});
