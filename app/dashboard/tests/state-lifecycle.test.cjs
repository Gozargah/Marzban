const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual TS modules with deterministic network/router adapters.
// No browser, backend, authentication, or new test dependency is required.
function load(file, mocks = {}) {
  const filename = path.join(__dirname, '../src', file);
  const source = fs.readFileSync(filename, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  const module = { exports: {} };
  const run = vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename });
  run((id) => id in mocks ? mocks[id] : require(id), module, module.exports);
  return module.exports;
}
const latest = load('utils/latest-request.ts');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function network() {
  const calls = [];
  return { calls, fetch: (url, options) => {
    const request = deferred();
    calls.push({ url, options, ...request });
    return request.promise;
  }};
}
function dashboard(net) {
  return load('contexts/dashboard-context.tsx', {
    '@/pages/router': { router: { navigate() {} } },
    '@/components/dashboard/statistics': { StatisticsQueryKey: 'statistics' },
    'service/http': net,
    'utils/react-query': { queryClient: { invalidateQueries() {} } },
    'utils/userPreferenceStorage': { getUsersPerPageLimitSize: () => 10 },
    'utils/latest-request': latest,
  });
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

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

test('users keep latest results, preserve filters, and maintain loading across out-of-order replies', async () => {
  const net = network();
  const { useDashboard: store } = dashboard(net);
  store.getState().onFilterChange({ search: 'old', offset: 0 }, false);
  const filters = store.getState().filters;
  assert.equal(filters.offset, 0);
  assert.equal(net.calls[0].options.query.offset, 0);
  store.getState().onFilterChange({ search: 'new' }, false);
  assert.equal(net.calls[0].options.signal.aborted, true);
  net.calls[0].resolve({ users: [{ username: 'old' }], total: 1 });
  await tick();
  assert.equal(store.getState().loading, true);
  assert.deepEqual(store.getState().users.users, []);
  net.calls[1].resolve({ users: [{ username: 'new' }], total: 1 });
  await tick();
  assert.equal(store.getState().users.users[0].username, 'new');
  assert.equal(store.getState().loading, false);
  assert.equal(filters.search, 'old');
});

test('failed users request exposes a retryable error; inbound reads do not clear user loading', async () => {
  const net = network();
  const { useDashboard: store, fetchInbounds } = dashboard(net);
  store.getState().refetchUsers();
  const inbound = fetchInbounds();
  net.calls[1].resolve({ shadowsocks: [] });
  await inbound;
  assert.equal(store.getState().loading, true);
  net.calls[0].reject(new Error('offline'));
  await tick();
  assert.equal(store.getState().loading, false);
  assert.equal(store.getState().usersError, true);
  store.getState().refetchUsers();
  assert.equal(store.getState().usersError, false);
  net.calls[2].resolve({ users: [], total: 0 });
  await tick();
});

test('narrow Zustand subscription ignores unrelated modal changes and unsubscribes cleanly', () => {
  const { useDashboard: store } = dashboard(network());
  let updates = 0;
  const unsubscribe = store.subscribe((state) => state.users, () => updates++);
  store.getState().onEditingHosts(true);
  store.getState().onEditingNodes(true);
  store.getState().setQRCode(['demo']);
  assert.equal(updates, 0);
  store.setState({ users: { users: [], total: 42 } });
  assert.equal(updates, 1);
  unsubscribe();
  store.setState({ users: { users: [], total: 43 } });
  assert.equal(updates, 1);
});

test('unmount cancellation prevents late users data from entering the store', async () => {
  const net = network();
  const { useDashboard: store, cancelUsersRequest } = dashboard(net);
  store.getState().refetchUsers();
  cancelUsersRequest();
  net.calls[0].resolve({ users: [{ username: 'late' }], total: 1 });
  await tick();
  assert.equal(net.calls[0].options.signal.aborted, true);
  assert.deepEqual(store.getState().users, { users: [], total: 0 });
  assert.equal(store.getState().loading, false);
});

test('closing hosts cancels reads; a late read cannot overwrite a successful save', async () => {
  const net = network();
  const { useHosts: store } = load('contexts/hosts-context.tsx', {
    'service/http': net, 'utils/latest-request': latest,
  });
  const reading = store.getState().fetchHosts();
  const saved = { demo: [{ remark: 'Saved', address: 'example.com', port: null }] };
  const writing = store.getState().setHosts(saved);
  assert.equal(net.calls[0].options.signal.aborted, true);
  net.calls[1].resolve(undefined);
  await writing;
  net.calls[0].resolve({ demo: [] });
  await reading;
  assert.deepEqual(store.getState().hosts, saved);
  const closing = store.getState().fetchHosts();
  store.getState().cancelFetch();
  net.calls[2].reject(new Error('aborted'));
  await closing;
  assert.equal(store.getState().isLoading, false);
});

test('core parallel reads update atomically; closing cancels both requests', async () => {
  const net = network();
  const { useCoreSettings: store } = load('contexts/core-settings-context.tsx', {
    'service/http': net, 'utils/latest-request': latest,
    '@/contexts/dashboard-context': { fetchInbounds: async () => {} },
  });
  const reading = store.getState().fetchCoreSettings();
  net.calls[0].resolve({ version: 'demo', started: true });
  await tick();
  assert.equal(store.getState().version, null);
  net.calls[1].resolve({ inbounds: [] });
  await reading;
  assert.equal(store.getState().version, 'demo');
  const closing = store.getState().fetchCoreSettings();
  store.getState().cancelFetch();
  assert.equal(net.calls[2].options.signal.aborted, true);
  assert.equal(net.calls[3].options.signal.aborted, true);
  net.calls[2].resolve({ version: 'late' });
  net.calls[3].resolve({ inbounds: ['late'] });
  await closing;
  assert.equal(store.getState().version, 'demo');
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
          getValue: () => '{}', setValue() {}, focus() {},
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

test('core config uses a stable string draft and sends a JSON object to the API', async () => {
  const net = network();
  const { useCoreSettings: store } = load('contexts/core-settings-context.tsx', {
    'service/http': net, 'utils/latest-request': latest,
    '@/contexts/dashboard-context': { fetchInbounds: async () => {} },
  });
  const config = { inbounds: [], outbounds: [] };
  const reading = store.getState().fetchCoreSettings();
  net.calls[0].resolve({ version: 'test', started: true });
  net.calls[1].resolve(config);
  await reading;
  assert.equal(typeof store.getState().config, 'string');
  const saving = store.getState().updateConfig(store.getState().config);
  assert.deepEqual(net.calls[2].options.body, config);
  net.calls[2].resolve(config);
  await saving;
  assert.equal(store.getState().config, JSON.stringify(config, null, 2));
  assert.equal(store.getState().isPostLoading, false);
});
