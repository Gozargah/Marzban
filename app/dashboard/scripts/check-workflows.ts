import { mkdtempSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

// Pin the validator independently from app dependencies, verify the release checksum,
// and leave no downloaded executable in the repository.
const version = "1.7.12";
const platform = process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : undefined;
const architecture = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "amd64" : undefined;
if (!platform || !architecture) throw new Error("Workflow validation supports Linux/macOS on x64/arm64");
const temporary = mkdtempSync(resolve(tmpdir(), "marzban-actionlint-"));
try {
  const name = `actionlint_${version}_${platform}_${architecture}.tar.gz`;
  const base = `https://github.com/rhysd/actionlint/releases/download/v${version}`;
  const download = async (name: string) => {
    const response = await fetch(`${base}/${name}`, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`actionlint download failed: ${response.status}`);
    return response;
  };
  const [archive, checksums] = await Promise.all([
    download(name).then((response) => response.arrayBuffer()),
    download(`actionlint_${version}_checksums.txt`).then((response) => response.text()),
  ]);
  const expected = checksums
    .split("\n")
    .find((line) => line.trim().split(/\s+/)[1] === name)
    ?.split(/\s+/)[0];
  if (!expected || new Bun.CryptoHasher("sha256").update(archive).digest("hex") !== expected)
    throw new Error("actionlint checksum verification failed");
  const archivePath = resolve(temporary, name);
  await Bun.write(archivePath, archive);
  const extract = Bun.spawnSync(["tar", "-xzf", archivePath, "-C", temporary, "actionlint"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (extract.exitCode !== 0) throw new Error("Could not extract actionlint");
  const executable = resolve(temporary, "actionlint");
  chmodSync(executable, 0o755);
  const result = Bun.spawnSync(
    [
      executable,
      "-shellcheck=",
      "-pyflakes=",
      ".github/workflows/frontend.yml",
      ".github/workflows/build.yml",
      ".github/workflows/build-dev.yml",
    ],
    {
      cwd: resolve(import.meta.dir, "../../.."),
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  if (result.exitCode !== 0) throw new Error("GitHub Actions workflow validation failed");
  console.log(`actionlint ${version}: frontend, dev, and release workflows passed`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
