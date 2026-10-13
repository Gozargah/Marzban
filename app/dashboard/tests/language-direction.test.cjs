const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createInstance } = require('i18next');

// Exercise the real initialization and languageChanged handler without a browser or network.
test('document direction follows initialization, live changes, and translation fallback', async () => {
  const previousDocument = global.document;
  const element = { lang: '', dir: '' };
  global.document = { documentElement: element };
  let unsubscribe = () => {};
  try {
    const instance = createInstance();
    const filename = path.join(__dirname, '../src/locales/i18n.ts');
    const source = fs.readFileSync(filename, 'utf8')
      .replaceAll('import.meta.env.NODE_ENV', "'test'")
      .replaceAll('import.meta.env.BASE_URL', "'/'");
    const output = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
    }}).outputText;
    const mocks = {
      i18next: instance,
      'i18next-browser-languagedetector': {
        type: 'languageDetector', init() {}, detect: () => 'fa', cacheUserLanguage() {},
      },
      'i18next-http-backend': {
        type: 'backend', init() {}, read(language, _namespace, callback) {
          callback(null, ['fa', 'en'].includes(language) ? { users: language === 'fa' ? 'کاربران' : 'Users' } : {});
        },
      },
      'react-i18next': { initReactI18next: { type: '3rdParty', init() {} } },
      'react-datepicker': { registerLocale() {} },
      'date-fns/locale/fa-IR': {}, 'date-fns/locale/ru': {}, 'date-fns/locale/zh-CN': {},
    };
    const module = { exports: {} };
    const run = vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename });
    run((id) => id in mocks ? mocks[id] : require(id), module, module.exports);
    if (!instance.isInitialized) await new Promise((resolve) => instance.on('initialized', resolve));
    assert.equal(element.lang, 'fa');
    assert.equal(element.dir, 'rtl');

    const notifications = [];
    const hookFilename = path.join(__dirname, '../src/hooks/use-locale.ts');
    const hookOutput = ts.transpileModule(fs.readFileSync(hookFilename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
    }}).outputText;
    const hookModule = { exports: {} };
    const runHook = vm.runInThisContext(`(function(require,module,exports){${hookOutput}\n})`, { filename: hookFilename });
    runHook((id) => {
      if (id === '@/locales/i18n') return instance;
      if (id === 'react') return { useSyncExternalStore(subscribe, getSnapshot) {
        unsubscribe = subscribe(() => notifications.push(getSnapshot()));
        return getSnapshot();
      }};
      return require(id);
    }, hookModule, hookModule.exports);
    assert.deepEqual(hookModule.exports.useLocale(), { language: 'fa', direction: 'rtl' });

    await instance.changeLanguage('en');
    assert.equal(element.lang, 'en');
    assert.equal(element.dir, 'ltr');
    await instance.changeLanguage('fa');
    assert.equal(element.lang, 'fa');
    assert.equal(element.dir, 'rtl');

    // An unavailable RTL language uses the direction of the displayed English fallback.
    await instance.changeLanguage('ar');
    assert.equal(instance.resolvedLanguage, 'en');
    assert.equal(element.lang, 'en');
    assert.equal(element.dir, 'ltr');
    assert.deepEqual(notifications, ['en', 'fa', 'en']);
    unsubscribe();
    await instance.changeLanguage('fa');
    assert.deepEqual(notifications, ['en', 'fa', 'en'], 'Unmounted locale subscribers must not receive updates');
  } finally {
    unsubscribe();
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});
