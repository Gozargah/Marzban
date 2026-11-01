import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function checkInstall(root: string, runtimeVersion = Bun.version) {
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const expected = manifest.packageManager?.match(/^bun@(\d+\.\d+\.\d+)$/)?.[1];
  if (!expected) throw new Error("packageManager must pin an exact Bun version");
  if (runtimeVersion !== expected) throw new Error(`Use Bun ${expected}; running ${runtimeVersion}`);
  if (!existsSync(resolve(root, "bun.lock")))
    throw new Error("bun.lock is required; restore the committed lockfile before installing");
  for (const file of ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package-lock.json", "yarn.lock", "bun.lockb"]) {
    if (existsSync(resolve(root, file)))
      throw new Error(`Remove obsolete ${file}; bun.lock is the installation source of truth`);
  }
  const lock = Bun.JSON5.parse(readFileSync(resolve(root, "bun.lock"), "utf8")) as {
    workspaces?: Record<string, Record<string, Record<string, string>>>;
  };
  const workspace = lock.workspaces?.[""];
  if (!workspace) throw new Error("bun.lock has no root workspace");
  for (const group of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    const entries = (value: Record<string, string> = {}) =>
      JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    if (entries(manifest[group]) !== entries(workspace[group]))
      throw new Error(`${group} disagrees with bun.lock; run bun install and review both files`);
  }
}
if (import.meta.main) {
  checkInstall(process.cwd());
  console.log("Bun version, manifest, and lockfile checks passed");
}
