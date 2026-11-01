import { expect, test } from "bun:test";
import { readFileSync, mkdtempSync, writeFileSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { checkInstall } from "../../scripts/check-install";
const root = resolve(import.meta.dir, "../..");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const pinnedBun = manifest.packageManager.slice(4);
test("pinned Bun and manifest agree with the sole lockfile", () => {
  expect(() => checkInstall(root, pinnedBun)).not.toThrow();
});
test("guard rejects absent, competing, and stale lockfiles", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "marzban-lock-"));
  try {
    copyFileSync(resolve(root, "package.json"), resolve(dir, "package.json"));
    expect(() => checkInstall(dir, pinnedBun)).toThrow("bun.lock is required");
    copyFileSync(resolve(root, "bun.lock"), resolve(dir, "bun.lock"));
    writeFileSync(resolve(dir, "pnpm-lock.yaml"), "lockfileVersion: 9");
    expect(() => checkInstall(dir, pinnedBun)).toThrow("obsolete pnpm-lock.yaml");
    rmSync(resolve(dir, "pnpm-lock.yaml"));
    writeFileSync(
      resolve(dir, "package.json"),
      JSON.stringify({ ...manifest, dependencies: { ...manifest.dependencies, react: "0.0.0" } }),
    );
    expect(() => checkInstall(dir, pinnedBun)).toThrow("dependencies disagrees");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
for (const name of ["frontend.yml", "build.yml", "build-dev.yml"])
  test(`${name}: install and validation gate the release build`, () => {
    const config: any = Bun.YAML.parse(readFileSync(resolve(root, "../../.github/workflows", name), "utf8"));
    const job = Object.values(config.jobs).find((job: any) =>
      job.steps?.some((step: any) => step.uses?.startsWith("oven-sh/setup-bun@")),
    ) as any;
    expect(job).toBeDefined();
    expect(job["timeout-minutes"]).toBeGreaterThan(0);
    const steps: any[] = job.steps;
    const setup = steps.findIndex((step) => step.uses?.startsWith("oven-sh/setup-bun@"));
    expect(steps[setup].with["bun-version"]).toBe(manifest.packageManager.slice(4));
    const index = (command: string) =>
      steps.findIndex((step) => step.run?.split("\n").some((line: string) => line.trim() === command));
    const install = index("bun install --frozen-lockfile");
    expect(index("bun run check:workflows")).toBeGreaterThan(setup);
    expect(index("bun run check:install")).toBeGreaterThan(index("bun run check:workflows"));
    expect(install).toBeGreaterThan(index("bun run check:install"));
    for (const command of ["bun --bun run typecheck", "bun run test", "bun run test:installation"])
      expect(index(command)).toBeGreaterThan(install);
    const build = index("bun --bun run build --outDir build --assetsDir statics");
    expect(build).toBeGreaterThan(index("bun run test:installation"));
    expect(steps[build].env.VITE_BASE_API).toBe("/api/");
    for (const step of steps.filter((step) => step.run)) {
      expect(step["working-directory"] ?? job.defaults?.run?.["working-directory"]).toMatch(
        /^\.\/app\/dashboard$|^app\/dashboard$/,
      );
      expect(step.run).not.toMatch(/\b(pnpm|yarn|npm)\s+(install|ci|run|build)\b/);
    }
    if (name !== "frontend.yml") {
      expect(steps.findIndex((step) => step.uses?.startsWith("docker/build-push-action@"))).toBeGreaterThan(build);
      expect(index("cp ./build/index.html ./build/404.html")).toBeGreaterThan(build);
      expect(job.permissions).toEqual({ contents: "read", packages: "write" });
      expect(steps.some((step) => step.uses === "docker/setup-qemu-action@v4")).toBe(true);
      expect(steps.some((step) => step.uses === "docker/setup-buildx-action@v4")).toBe(true);
      expect(steps.some((step) => step.uses === "docker/login-action@v4")).toBe(true);
      expect(steps.some((step) => step.uses === "docker/build-push-action@v7")).toBe(true);
    } else {
      expect(config.on.pull_request).toBeDefined();
      expect("workflow_dispatch" in config.on).toBe(true);
      expect(config.permissions).toEqual({ contents: "read" });
    }
  });

test("Docker image build does not install shell completion into the build user's home", () => {
  const dockerfile = readFileSync(resolve(root, "../../Dockerfile"), "utf8");
  expect(dockerfile).toContain("/usr/bin/marzban-cli");
  expect(dockerfile).not.toMatch(/marzban-cli completion install/);
});
