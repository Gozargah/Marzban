import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: false,
        ws: true,
      },
    },
  },
  resolve: {
    tsconfigPaths: true
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    svgr(),
    tailwindcss()
  ],
});
