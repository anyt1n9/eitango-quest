import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['icon.svg', 'icon-maskable.svg'],
        manifest: {
          name: 'Eigorira',
          short_name: 'Eigorira',
          description: 'レベル別の英単語学習アプリ。間隔反復による復習、発音、AI機能を搭載。',
          lang: 'ja',
          theme_color: '#4f46e5',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            {src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any'},
            {src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable'},
          ],
        },
        workbox: {
          // バンドルに 1.5MB の単語データ(vocabulary.ts)が含まれるため、プリキャッシュ上限を引き上げる
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
          // 海の3D背景（試験中）の three.js と画面は、使う人だけが取りに来る。
          // インストール時に全員へ配ると、使わない人の端末にも数百KBの通信が出る
          globIgnores: ['**/three-*.js', '**/OceanBackground-*.js'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              // 一度取ったら端末に置いておき、オフラインでも海を出す（裏で新しい版を確かめる）
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/ocean/') || /\/assets\/(three|OceanBackground)-[^/]+\.js$/.test(url.pathname),
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'ocean-3d', expiration: { maxEntries: 8 } },
            },
          ],
        },
        devOptions: {
          // 開発時(vite middleware)は Service Worker を無効化してHMRと干渉させない
          enabled: false,
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          // three.js を名前の分かる別ファイルにする（上の globIgnores で配るのを止めるため）
          manualChunks(id: string) {
            if (id.includes('/node_modules/three/')) return 'three';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
