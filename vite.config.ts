/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Makes the app installable and usable offline: a service worker stores every file
    // of the built app on the device after the first visit.
    VitePWA({
      // 'prompt': a new version waits until the player taps "อัปเดต" (never mid-fight).
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'DND Table Companion',
        short_name: 'DND Table',
        description: 'ผู้ช่วยโต๊ะ D&D: ใบตัวละคร ตัวติดตามการต่อสู้ และตัวทอยลูกเต๋า',
        lang: 'th',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0c0a09',
        theme_color: '#1c1917',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Store everything the app needs: code, styles, the Thai font, icons, the monster list.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // The app uses #/ routes, so any page load can be answered with index.html.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Item pictures (public/items, about 1.5 MB in all): kept as they are looked at, so the first
            // install stays small but an item you have seen still shows at the table with no internet.
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/items/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'item-art',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // Build time shown on the About page, so players can tell which version they have.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
