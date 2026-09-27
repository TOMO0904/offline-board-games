import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { partyIds } from './src/party/catalog'

const base = process.env.BASE_PATH || '/'
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'] },
      manifest: {
        id: base,
        name: 'Offline Board Games',
        short_name: 'Offline Games',
        description: `圏外でも、みんなで遊ぼう。${5 + partyIds.length}ゲーム・2〜7人。`,
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#122c29',
        background_color: '#f5f3ed',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: { manualChunks: { 'qr-tools': ['qrcode', 'jsqr'], 'chess-engine': ['chess.js'] } },
    },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
