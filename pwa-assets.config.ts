// Generates the app icons in public/ from public/icon.svg: npx pwa-assets-generator
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Dark background behind the maskable (Android) and Apple icons.
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#1c1917' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#1c1917' } },
  },
  images: ['public/icon.svg'],
})
