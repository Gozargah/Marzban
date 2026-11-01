import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, basename } from "node:path";
const source = resolve(import.meta.dir, "../..");
// Opt in explicitly: normal tests never install dependencies or contact the registry.
(process.env.RUN_INSTALL_TESTS === "1" ? test : test.skip)("fresh frozen install builds release assets and rejects manifest drift", () => {
  const temporary = mkdtempSync(resolve(tmpdir(), "marzban-install-"));
  const root = resolve(temporary, "app/dashboard");
  try {
    cpSync(source, root, { recursive: true, filter: (path) => !["node_modules", "build", "coverage", ".git", ".env"].includes(basename(path)) && !basename(path).startsWith(".env.") });
    cpSync(resolve(source, "../../.github"), resolve(temporary, ".github"), { recursive: true });
    expect(existsSync(resolve(root, "node_modules"))).toBe(false);
    const original = readFileSync(resolve(root, "bun.lock"), "utf8");
    const run = (args: string[], success = true) => {
      const result = Bun.spawnSync([process.execPath, ...args], { cwd: root, env: { ...process.env, VITE_BASE_API: "/api/" }, stdout: "pipe", stderr: "pipe", timeout: 120_000 });
      const output = Buffer.from(result.stdout).toString() + Buffer.from(result.stderr).toString();
      if (success && result.exitCode !== 0) throw new Error(`${args.join(" ")} failed (${result.exitCode}):\n${output}`);
      return { ...result, output };
    };
    const cache = process.env.INSTALL_COLD_CACHE === "1" ? ["--cache-dir", resolve(temporary, "empty-cache")] : [];
    run(["run", "check:install"]);
    console.info("Checking a clean frozen dependency installation");
    run(["install", "--frozen-lockfile", ...cache]);
    expect(readFileSync(resolve(root, "bun.lock"), "utf8")).toBe(original);
    run(["install", "--frozen-lockfile", "--offline", ...cache]);
    expect(readFileSync(resolve(root, "bun.lock"), "utf8")).toBe(original);
    console.info("Checking offline reinstall, types, and release build");
    run(["--bun", "run", "typecheck"]);
    run(["--bun", "run", "build", "--outDir", "build", "--assetsDir", "statics"]);
    const html = readFileSync(resolve(root, "build/index.html"), "utf8");
    const assets = [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map((match) => match[1]);
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) {
      expect(asset).toMatch(/^\/statics\//);
      expect(existsSync(resolve(root, "build", asset.replace(/^\//, "")))).toBe(true);
    }
    expect(existsSync(resolve(root, "build/statics/locales/en.json"))).toBe(true);
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")); pkg.dependencies.react = pkg.dependencies.react.replace(/^\^/, "");
    writeFileSync(resolve(root, "package.json"), JSON.stringify(pkg));
    console.info("Checking manifest drift rejection without lockfile changes");
    const guard = run(["run", "check:install"], false);
    expect(guard.exitCode).not.toBe(0);
    expect(guard.output).toMatch(/dependencies disagrees/);
    const rejected = run(["install", "--frozen-lockfile", "--ignore-scripts", ...cache], false);
    expect(rejected.exitCode).not.toBe(0); expect(rejected.output).toMatch(/lockfile|frozen/i);
    expect(readFileSync(resolve(root, "bun.lock"), "utf8")).toBe(original);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}, 240_000);
