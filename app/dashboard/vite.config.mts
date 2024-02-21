import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, splitVendorChunkPlugin } from "vite";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      app: path.resolve(__dirname, "src/app"),
      assets: path.resolve(__dirname, "src/assets"),
      components: path.resolve(__dirname, "src/components"),
      contexts: path.resolve(__dirname, "src/contexts"),
      pages: path.resolve(__dirname, "src/pages"),
      core: path.resolve(__dirname, "src/core"),
    },
  },

  plugins: [tsconfigPaths(), react(), svgr(), visualizer(), splitVendorChunkPlugin()],
});
