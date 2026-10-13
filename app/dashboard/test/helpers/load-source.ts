import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve, extname } from "node:path";
import ts from "typescript";
import * as reactI18next from "react-i18next";
import * as reactQuery from "@tanstack/react-query";

const sourceRoot = resolve(import.meta.dir, "../../src");
const requireDependency = createRequire(resolve(sourceRoot, "../package.json"));

/** Isolated source graph: real TS/React modules, injected I/O, no global module mocks.
 * Vite-only env/SVG imports are adapted here, never in individual assertions.
 * Each call creates fresh module-scoped stores and request owners.
 */
export function loadSource<T = any>(file: string, adapters: Record<string, unknown> = {}): T {
  const cache = new Map<string, { exports: any }>();
  function load(filename: string): any {
    if (cache.has(filename)) return cache.get(filename)!.exports;
    const module = { exports: {} as any };
    cache.set(filename, module);
    const source = readFileSync(filename, "utf8")
      .replaceAll("import.meta.env.VITE_BASE_API", '"/api"')
      .replaceAll("import.meta.env.BASE_URL", '"/"')
      .replaceAll("import.meta.env.NODE_ENV", '"test"');
    const output = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    }}).outputText;
    const localRequire = (id: string) => {
      if (Object.hasOwn(adapters, id)) return adapters[id];
      if (id === "react-i18next") return reactI18next;
      if (id === "@tanstack/react-query") return reactQuery;
      if (id.startsWith(".") || id.startsWith("@/") || /^(utils|service|types|constants|contexts|hooks|components)\//.test(id)) {
        const path = id.startsWith(".") ? resolve(dirname(filename), id) : resolve(sourceRoot, id.replace(/^@\//, ""));
        if (extname(path)) return load(path);
        for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
          try { readFileSync(path + suffix); } catch { continue; }
          return load(path + suffix);
        }
        throw new Error(`Cannot resolve ${id} from ${filename}`);
      }
      return requireDependency(id);
    };
    new Function("require", "module", "exports", output)(localRequire, module, module.exports);
    return module.exports;
  }
  return load(resolve(sourceRoot, file));
}
