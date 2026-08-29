/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare global {
  interface Window {
    has_unsaved_changes: boolean
  }
}

export { }
