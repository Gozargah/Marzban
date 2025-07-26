import react from '@vitejs/plugin-react'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.BASE_URL,
  clearScreen: false,
  server: {
    host: true,
  },
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  build: {
    outDir: 'build',
    assetsDir: 'statics',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          'react-router': ['react-router'],
          'react-query': ['@tanstack/react-query'],
          recharts: ['recharts'],
          radix: [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          zustand: ['zustand'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector', 'i18next-http-backend'],
          lodash: ['lodash.debounce'],
          dayjs: ['dayjs'],
          utils: ['clsx', 'uuid', 'date-fns', 'date-fns-jalali'],
        },
      },
    },
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, 'src'),
      },
    ],
  },
  plugins: [
    react(),
    svgr(),
    tsconfigPaths(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // Disable automatic registration
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      }
      // Remove the manifest configuration entirely - we'll handle it dynamically
    })
  ],
})
