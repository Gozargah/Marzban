const { test } = require('bun:test');
const assert = require('node:assert/strict');
const { loadSource: load } = require('../helpers/load-source');
const { deferred, network, flushPromises: tick } = require('../helpers/network');
const latest = load('utils/latest-request.ts');

test('latest read aborts superseded work; old completion cannot cancel the new request', () => {
  const owner = latest.createLatestRequest();
  const first = owner.start();
  const second = owner.start();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  first.finish();
  assert.equal(second.isCurrent(), true);
  owner.cancel();
  assert.equal(second.signal.aborted, true);
  assert.equal(second.isCurrent(), false);
});







test('log buffer bounds line count, oversized text, and releases data on clear', () => {
  const { createLogBuffer } = load('utils/log-buffer.ts');
  const buffer = createLogBuffer(3, 12);
  buffer.append('aaa\nbbb\nccc\nddd');
  assert.deepEqual(buffer.snapshot(), ['bbb', 'ccc', 'ddd']);
  buffer.append('x'.repeat(100_000));
  assert.ok(buffer.snapshot().length <= 3);
  assert.ok(buffer.snapshot().join('').length <= 12);
  const snapshot = buffer.snapshot();
  snapshot.push('external change');
  assert.ok(buffer.snapshot().length <= 3);
  buffer.clear();
  assert.deepEqual(buffer.snapshot(), []);
  const many = createLogBuffer();
  many.append('x\n'.repeat(1_000_000));
  assert.equal(many.snapshot().length, 10_000);
});

test('repeated editor mounts release models, listeners, actions, and pending changes', async () => {
  let effects = [];
  let models = 0, editors = 0, listeners = 0, actions = 0, pending = 0;
  let contentChanged;
  const react = {
    forwardRef: (render) => render,
    use: () => ({}),
    useRef: (current) => ({ current }),
    useImperativeHandle() {},
    useEffect: (effect) => effects.push(effect),
  };
  const disposable = () => {
    listeners++;
    return { dispose() { listeners--; } };
  };
  const monaco = {
    KeyMod: { CtrlCmd: 1 }, KeyCode: { KeyS: 1 },
    editor: {
      setTheme() {},
      createModel(value) {
        models++;
        return {
          onDidChangeContent(fn) { contentChanged = fn; return disposable(); },
          dispose() { models--; },
        };
      },
      create() {
        editors++;
        return {
          getValue: () => '{}', setValue() {}, focus() {}, updateOptions() {},
          onDidBlurEditorWidget: disposable, onDidPaste: disposable,
          addAction() { actions++; return { dispose() { actions--; } }; },
          dispose() { editors--; },
        };
      },
    },
  };
  const { JsonEditor } = load('components/JsonEditor/index.tsx', {
    react,
    './monaco': { monaco, jsonDefaults: { setDiagnosticsOptions() {} } },
    './shiki': { highlighter: Promise.resolve({}) },
    '@shikijs/monaco': { shikiToMonaco() {} },
    '@gozargah/xray-schema/full/schema.json': {},
    '@/components/theme-provider': { useTheme: () => ({ resolvedTheme: 'dark' }) },
    'lodash.debounce': (fn) => {
      let queued = false;
      const run = () => { if (!queued) { pending++; queued = true; } };
      run.cancel = () => { if (queued) pending--; queued = false; };
      run.flush = () => { if (queued) { run.cancel(); fn(); } };
      return run;
    },
  });
  await tick();
  for (let i = 0; i < 30; i++) {
    effects = [];
    JsonEditor({ json: {}, onChange() {}, onSave() {} }, null);
    const cleanups = effects.map((effect) => effect());
    contentChanged();
    assert.equal(models, 1);
    assert.equal(editors, 1);
    assert.equal(pending, 1);
    if (i === 0) {
      window.dispatchEvent(new Event("marzban:flush-drafts"));
      assert.equal(pending, 0);
      contentChanged();
    }
    cleanups.reverse().forEach((cleanup) => cleanup?.());
    assert.deepEqual({ models, editors, listeners, actions, pending },
      { models: 0, editors: 0, listeners: 0, actions: 0, pending: 0 });
  }
});

test('admin routing and header can share a fresh cached read', async () => {
  const { QueryClient } = require('@tanstack/react-query');
  let requests = 0;
  const { adminQueryOptions } = load('utils/admin-query.ts', {
    'service/http': { fetch: async () => { requests++; return { username: 'demo', is_sudo: true }; } },
  });
  const client = new QueryClient();
  await client.fetchQuery({ ...adminQueryOptions, staleTime: 0 });
  await client.fetchQuery(adminQueryOptions);
  assert.equal(requests, 1);
  client.clear();
});
