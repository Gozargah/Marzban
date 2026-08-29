import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
