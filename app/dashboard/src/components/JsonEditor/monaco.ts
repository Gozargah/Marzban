import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
// @ts-expect-error this is not fully typed
import { jsonDefaults } from "monaco-editor/esm/vs/language/json/monaco.contribution.js";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "json") return new jsonWorker();

    // fallback lightweight editor worker
    return new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url), {
      type: "module",
    });
  },
};

export { monaco, jsonDefaults };
