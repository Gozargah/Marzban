# Frontend tests

Run from `app/dashboard` with Bun 1.4.3 or later:

```sh
bun install --frozen-lockfile
bun run test
bun run test:typecheck
bun run typecheck
```

`bun test` also works: `bunfig.toml` sets this singular `test` folder as the test root and loads the DOM before Testing Library.

```sh
bun run test:watch
bun run test:coverage
bun test ./test/components/login.test.tsx
bun test ./test/state
bun test --test-name-pattern 'cancellation'
```

## Organization

| Folder | Behaviors covered |
| --- | --- |
| `unit` | Authentication storage, page preferences, HTTP authentication, byte/number/date formatting, chart palette, log bounds, request ownership |
| `state` | User mutations and filters, node validation and API actions, hosts and core success/failure paths, access loader and shared admin cache |
| `components` | Login validation and retry, user form validation/payload conversion, table empty/error/sort states, search debounce and cleanup, pagination, translated connection/status labels, theme persistence, statistics retry, usage ranges, node usage races, hosts/core/nodes dialogs, destructive actions, QR carousel, websocket logs |
| `hooks` | Reactive locale, authenticated admin, inbound loading/error/retry/cancellation |
| `regression` | Existing request race, cancellation, store subscription, editor disposal, cache reuse, and language metadata regressions migrated from `node:test` to `bun:test` |
| `helpers` | Fresh fixtures, deferred network requests, isolated source loading, real translation/query providers |

## Adding tests

1. Put `*.test.ts` or `*.test.tsx` alongside the appropriate feature folder and import test APIs from `bun:test`.
2. Test observable behavior: accessible roles/labels, emitted API payloads, resulting state, and errors. Avoid CSS snapshots, source-text assertions, and assertions that repeat an implementation.
3. Import pure utilities and dependency-injected feature resources directly. Use `loadSource<typeof import("../../src/...")>` for modules with Vite imports or module-scoped stores. Each invocation evaluates a fresh source graph and injects external boundaries without global `mock.module` contamination. It executes real production TypeScript/React code; it does not copy business logic. The loader adapts Vite environment values and preserves shared query/translation provider modules.
4. Use `renderFrontend` for a fresh QueryClient and real, offline English/Persian translations. Inject transport, navigation, clipboard/canvas, editor, and chart adapters only where necessary. Keep the feature/component under test real.
5. Use `network()` and resolve/reject requests explicitly. Exercise pending, success, failure, retry, cancellation, and out-of-order replies when relevant. Await every asynchronous assertion. Use `waitFor`/`findBy` instead of arbitrary sleeps; the two cleanup tests deliberately wait beyond a real debounce/flush interval to prove callbacks do not run.
6. Use `makeUser`/`makeUserCreate` for fresh typed fixtures, overriding only relevant fields. Reset module-scoped stores by creating a fresh isolated source graph for each test.
7. Global cleanup unmounts components, clears browser storage, restores spies/time, and releases query caches. Add resource-specific cleanup when a test creates a new resource. Do not use concurrent tests with shared DOM/storage/time.

## Scope and coverage

The suite runs without a dev server, real backend, browser preview, credentials, or translation downloads. Happy DOM and React Testing Library follow [Bun's documented DOM testing setup](https://bun.sh/docs/test/dom).

These are unit and headless component tests, not end-to-end or visual tests. Chart painting, QR canvas encoding, Monaco's actual browser worker, CSS layout/responsiveness, and real server/websocket integration are outside this suite. Their payload/lifecycle contracts are tested through adapters. Shared UI primitives are exercised by feature interactions rather than tested once per wrapper file.

Bun's coverage command produces `coverage/lcov.info` for directly imported modules. Modules evaluated by the isolated TypeScript loader (`new Function`) are not attributed reliably to their original source files by Bun's coverage instrumentation. Do not interpret the report as whole-frontend coverage or set a whole-app percentage gate from it. Production type-checking remains separate to validate the source and Vite aliases in addition to behavioral tests.

## Frontend improvement regressions

`components/deferred-dialog.test.tsx` and `components/dashboard-loading.test.tsx` cover first-open loading, retained sheets, independent feature boundaries, cancellation, and import retry. `hooks/inbounds.test.tsx` covers visible failure/retry state and cancellation. `unit/user-form.test.ts` imports the extracted feature module directly to cover defaults, validation, form-unit conversions, and payload mapping without dynamic source evaluation.

## Feature architecture and regression coverage

Server data belongs to TanStack Query: typed keys and dependency-injected resources live in `src/features`. Zustand holds dialog selection and filters; React Hook Form holds editable drafts. Query mutations invalidate related data only after a successful write. Tests construct a fresh QueryClient and transport for each resource, covering cancellation, preserved previous data, offline writes, cache updates, and failed requests without a backend.

Direct imports cover user/host form mapping, users/hosts/core resources, core configuration validation, traffic series, and draft persistence. Component tests cover deployment recovery, restored drafts, storage failures, route retry, accessible traffic summaries, row keyboard activation, and protocol selection. Restore tests exercise observable form values rather than storage implementation details.

Deployment recovery never reloads automatically. Drafts are tab-scoped, expire after six hours, and clear on save/discard/logout. Tests flush delayed editor changes before reload and block reload when storage is unavailable. Keep test transports deterministic and settle pending async work inside `act` before cleanup.

Dialog opening regressions also assert that real shells appear synchronously without a generic loading step, remain mounted across close/reopen, and that intent preloading deduplicates downloads while permitting retries after failure. Heavy editor/chart code stays lazy inside the shell.
