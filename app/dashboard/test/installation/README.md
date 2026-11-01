# Bun migration and workflow verification

## Commands

From `app/dashboard`, using Bun 1.4.3:

```sh
bun run check:install
bun test ./test/installation
bun run test:installation
INSTALL_COLD_CACHE=1 bun run test:installation
```

The first two commands are fast and offline. The opt-in integration command copies the frontend and workflow fixtures into a disposable directory, without `node_modules`, build output, coverage, or environment files. It installs frozen dependencies, repeats the install offline, type-checks, builds with release arguments using the Bun runtime, verifies HTML references point to existing emitted JavaScript/CSS and shipped translations, and proves Bun rejects a changed dependency manifest without modifying the lockfile. All temporary files are removed, including on failure.

The cold-cache variant also starts with an empty package cache and requires registry access. It exercises downloads, integrity verification, platform binaries, dependency lifecycle behavior, and repeat offline installation. The regular variant starts with no installed dependencies but may reuse the user's package cache. Normal `bun test` skips this expensive integration case; it runs the parsed YAML contracts and lockfile guard tests.

## Workflows

`frontend.yml` runs for frontend pull requests, pushes to main/master, and manual dispatch. It pins Bun, validates installation inputs before a frozen install, checks types/tests, runs the cold-cache integration test, and builds the same `build/statics` layout used for release. It uses a read-only token and cancels superseded runs.

`build.yml` runs on version tags. The same input, type, behavior, installation, and artifact checks must pass before the release build, 404 copy, registry login, and multi-platform image publication. Its token grants package write permission for GHCR. Linux-native package installation happens on the GitHub runner; local macOS verification cannot establish Linux compatibility or verify registry credentials. Actual publishing is outside these tests.

The YAML tests parse documents rather than matching text snapshots. They check ordering, effective working directories, shared runtime version, frozen installation, release environment/arguments, and validation before publication. They are repository policy checks, not a replacement for GitHub's workflow engine or actionlint. No lockfile/history test can prove an earlier pnpm resolution was preserved when that original lockfile is unavailable.

## Dependency lifecycle policy

Bun restricts dependency lifecycle scripts; it uses a built-in allowlist when `trustedDependencies` is omitted. Do not add blanket trust or `--ignore-scripts` to make a failed build pass. Review `bun pm untrusted`, audit any required script, and explicitly trust only required packages. An explicit `trustedDependencies` array replaces the built-in allowlist. Native build verification is more useful than assuming successful installation proves all binaries work.

## Official references

- [Bun frozen installs, migration, and cache behavior](https://bun.sh/docs/pm/cli/install)
- [Bun lifecycle script policy](https://bun.sh/docs/pm/lifecycle)
- [Official setup-bun workflow guidance](https://bun.sh/guides/runtime/cicd)
- [Bun runtime selection for scripts](https://bun.sh/docs/runtime/bunfig)
- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [actionlint workflow validation](https://github.com/rhysd/actionlint)

Run `bun run check:workflows` for actionlint 1.7.12 validation on Linux/macOS. It downloads the official release, verifies the published SHA-256 checksum, validates the two workflows (including GitHub expressions/action inputs/runtime versions), and removes its temporary executable. Network access is required. Both workflows run it before installation. External ShellCheck/Pyflakes integration is disabled; this check validates GitHub Actions semantics. This complements the offline repository-policy tests.

Bun 1.4.3 accepted a dependency removal during verification, so the independent input guard checks exact direct dependency agreement before installation. The real frozen-install negative case changes a version requirement while retaining the resolved version; registry metadata may be fetched, and it must fail specifically because the lockfile is frozen. This avoids mistaking a registry/network failure for a successful lockfile check.

## Verification completed in this workspace

- Bun 1.4.3 on macOS arm64: cold-cache integration command passed (5 installation/policy tests, including fresh downloads, native production build, offline reinstall, artifacts, and intentional frozen-lockfile failure).
- Full default suite: 213 passed; the expensive clean-install test is intentionally skipped. Randomized seed 42 also passed.
- Source, test, and installation-script TypeScript checks passed.
- actionlint 1.7.12 passed for both workflows after obsolete Docker action runtimes were updated to the maintainers' current documented major versions.
- Neither the GitHub-hosted Linux jobs nor registry publication was executed locally. Their success still depends on runner/platform compatibility and valid registry credentials.
