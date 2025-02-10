(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.monaco_loader = factory());
}(this, (function () { 'use strict';

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      if (enumerableOnly) symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
      keys.push.apply(keys, symbols);
    }

    return keys;
  }

  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};

      if (i % 2) {
        ownKeys(Object(source), true).forEach(function (key) {
          _defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }

    return target;
  }

  function _objectWithoutPropertiesLoose(source, excluded) {
    if (source == null) return {};
    var target = {};
    var sourceKeys = Object.keys(source);
    var key, i;

    for (i = 0; i < sourceKeys.length; i++) {
      key = sourceKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      target[key] = source[key];
    }

    return target;
  }

  function _objectWithoutProperties(source, excluded) {
    if (source == null) return {};

    var target = _objectWithoutPropertiesLoose(source, excluded);

    var key, i;

    if (Object.getOwnPropertySymbols) {
      var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

      for (i = 0; i < sourceSymbolKeys.length; i++) {
        key = sourceSymbolKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
        target[key] = source[key];
      }
    }

    return target;
  }

  function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
  }

  function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
  }

  function _iterableToArrayLimit(arr, i) {
    if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
  }

  function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;

    for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

    return arr2;
  }

  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  function _defineProperty$1(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function ownKeys$1(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      if (enumerableOnly) symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
      keys.push.apply(keys, symbols);
    }

    return keys;
  }

  function _objectSpread2$1(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};

      if (i % 2) {
        ownKeys$1(Object(source), true).forEach(function (key) {
          _defineProperty$1(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys$1(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }

    return target;
  }

  function compose() {
    for (var _len = arguments.length, fns = new Array(_len), _key = 0; _key < _len; _key++) {
      fns[_key] = arguments[_key];
    }

    return function (x) {
      return fns.reduceRight(function (y, f) {
        return f(y);
      }, x);
    };
  }

  function curry(fn) {
    return function curried() {
      var _this = this;

      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return args.length >= fn.length ? fn.apply(this, args) : function () {
        for (var _len3 = arguments.length, nextArgs = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          nextArgs[_key3] = arguments[_key3];
        }

        return curried.apply(_this, [].concat(args, nextArgs));
      };
    };
  }

  function isObject(value) {
    return {}.toString.call(value).includes('Object');
  }

  function isEmpty(obj) {
    return !Object.keys(obj).length;
  }

  function isFunction(value) {
    return typeof value === 'function';
  }

  function hasOwnProperty(object, property) {
    return Object.prototype.hasOwnProperty.call(object, property);
  }

  function validateChanges(initial, changes) {
    if (!isObject(changes)) errorHandler('changeType');
    if (Object.keys(changes).some(function (field) {
      return !hasOwnProperty(initial, field);
    })) errorHandler('changeField');
    return changes;
  }

  function validateSelector(selector) {
    if (!isFunction(selector)) errorHandler('selectorType');
  }

  function validateHandler(handler) {
    if (!(isFunction(handler) || isObject(handler))) errorHandler('handlerType');
    if (isObject(handler) && Object.values(handler).some(function (_handler) {
      return !isFunction(_handler);
    })) errorHandler('handlersType');
  }

  function validateInitial(initial) {
    if (!initial) errorHandler('initialIsRequired');
    if (!isObject(initial)) errorHandler('initialType');
    if (isEmpty(initial)) errorHandler('initialContent');
  }

  function throwError(errorMessages, type) {
    throw new Error(errorMessages[type] || errorMessages["default"]);
  }

  var errorMessages = {
    initialIsRequired: 'initial state is required',
    initialType: 'initial state should be an object',
    initialContent: 'initial state shouldn\'t be an empty object',
    handlerType: 'handler should be an object or a function',
    handlersType: 'all handlers should be a functions',
    selectorType: 'selector should be a function',
    changeType: 'provided value of changes should be an object',
    changeField: 'it seams you want to change a field in the state which is not specified in the "initial" state',
    "default": 'an unknown error accured in `state-local` package'
  };
  var errorHandler = curry(throwError)(errorMessages);
  var validators = {
    changes: validateChanges,
    selector: validateSelector,
    handler: validateHandler,
    initial: validateInitial
  };

  function create(initial) {
    var handler = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    validators.initial(initial);
    validators.handler(handler);
    var state = {
      current: initial
    };
    var didUpdate = curry(didStateUpdate)(state, handler);
    var update = curry(updateState)(state);
    var validate = curry(validators.changes)(initial);
    var getChanges = curry(extractChanges)(state);

    function getState() {
      var selector = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function (state) {
        return state;
      };
      validators.selector(selector);
      return selector(state.current);
    }

    function setState(causedChanges) {
      compose(didUpdate, update, validate, getChanges)(causedChanges);
    }

    return [getState, setState];
  }

  function extractChanges(state, causedChanges) {
    return isFunction(causedChanges) ? causedChanges(state.current) : causedChanges;
  }

  function updateState(state, changes) {
    state.current = _objectSpread2$1(_objectSpread2$1({}, state.current), changes);
    return changes;
  }

  function didStateUpdate(state, handler, changes) {
    isFunction(handler) ? handler(state.current) : Object.keys(changes).forEach(function (field) {
      var _handler$field;

      return (_handler$field = handler[field]) === null || _handler$field === void 0 ? void 0 : _handler$field.call(handler, state.current[field]);
    });
    return changes;
  }

  var index = {
    create: create
  };

  var config = {
    paths: {
      vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs'
    }
  };

  function curry$1(fn) {
    return function curried() {
      var _this = this;

      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return args.length >= fn.length ? fn.apply(this, args) : function () {
        for (var _len2 = arguments.length, nextArgs = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          nextArgs[_key2] = arguments[_key2];
        }

        return curried.apply(_this, [].concat(args, nextArgs));
      };
    };
  }

  function isObject$1(value) {
    return {}.toString.call(value).includes('Object');
  }

  /**
   * validates the configuration object and informs about deprecation
   * @param {Object} config - the configuration object 
   * @return {Object} config - the validated configuration object
   */

  function validateConfig(config) {
    if (!config) errorHandler$1('configIsRequired');
    if (!isObject$1(config)) errorHandler$1('configType');

    if (config.urls) {
      informAboutDeprecation();
      return {
        paths: {
          vs: config.urls.monacoBase
        }
      };
    }

    return config;
  }
  /**
   * logs deprecation message
   */


  function informAboutDeprecation() {
    console.warn(errorMessages$1.deprecation);
  }

  function throwError$1(errorMessages, type) {
    throw new Error(errorMessages[type] || errorMessages["default"]);
  }

  var errorMessages$1 = {
    configIsRequired: 'the configuration object is required',
    configType: 'the configuration object should be an object',
    "default": 'an unknown error accured in `@monaco-editor/loader` package',
    deprecation: "Deprecation warning!\n    You are using deprecated way of configuration.\n\n    Instead of using\n      monaco.config({ urls: { monacoBase: '...' } })\n    use\n      monaco.config({ paths: { vs: '...' } })\n\n    For more please check the link https://github.com/suren-atoyan/monaco-loader#config\n  "
  };
  var errorHandler$1 = curry$1(throwError$1)(errorMessages$1);
  var validators$1 = {
    config: validateConfig
  };

  var compose$1 = function compose() {
    for (var _len = arguments.length, fns = new Array(_len), _key = 0; _key < _len; _key++) {
      fns[_key] = arguments[_key];
    }

    return function (x) {
      return fns.reduceRight(function (y, f) {
        return f(y);
      }, x);
    };
  };

  function merge(target, source) {
    Object.keys(source).forEach(function (key) {
      if (source[key] instanceof Object) {
        if (target[key]) {
          Object.assign(source[key], merge(target[key], source[key]));
        }
      }
    });
    return _objectSpread2(_objectSpread2({}, target), source);
  }

  // The source (has been changed) is https://github.com/facebook/react/issues/5465#issuecomment-157888325
  var CANCELATION_MESSAGE = {
    type: 'cancelation',
    msg: 'operation is manually canceled'
  };

  function makeCancelable(promise) {
    var hasCanceled_ = false;
    var wrappedPromise = new Promise(function (resolve, reject) {
      promise.then(function (val) {
        return hasCanceled_ ? reject(CANCELATION_MESSAGE) : resolve(val);
      });
      promise["catch"](reject);
    });
    return wrappedPromise.cancel = function () {
      return hasCanceled_ = true;
    }, wrappedPromise;
  }

  /** the local state of the module */

  var _state$create = index.create({
    config: config,
    isInitialized: false,
    resolve: null,
    reject: null,
    monaco: null
  }),
      _state$create2 = _slicedToArray(_state$create, 2),
      getState = _state$create2[0],
      setState = _state$create2[1];
  /**
   * set the loader configuration
   * @param {Object} config - the configuration object
   */


  function config$1(globalConfig) {
    var _validators$config = validators$1.config(globalConfig),
        monaco = _validators$config.monaco,
        config = _objectWithoutProperties(_validators$config, ["monaco"]);

    setState(function (state) {
      return {
        config: merge(state.config, config),
        monaco: monaco
      };
    });
  }
  /**
   * handles the initialization of the monaco-editor
   * @return {Promise} - returns an instance of monaco (with a cancelable promise)
   */


  function init() {
    var state = getState(function (_ref) {
      var monaco = _ref.monaco,
          isInitialized = _ref.isInitialized,
          resolve = _ref.resolve;
      return {
        monaco: monaco,
        isInitialized: isInitialized,
        resolve: resolve
      };
    });

    if (!state.isInitialized) {
      setState({
        isInitialized: true
      });

      if (state.monaco) {
        state.resolve(state.monaco);
        return makeCancelable(wrapperPromise);
      }

      if (window.monaco && window.monaco.editor) {
        storeMonacoInstance(window.monaco);
        state.resolve(window.monaco);
        return makeCancelable(wrapperPromise);
      }

      compose$1(injectScripts, getMonacoLoaderScript)(configureLoader);
    }

    return makeCancelable(wrapperPromise);
  }
  /**
   * injects provided scripts into the document.body
   * @param {Object} script - an HTML script element
   * @return {Object} - the injected HTML script element
   */


  function injectScripts(script) {
    return document.body.appendChild(script);
  }
  /**
   * creates an HTML script element with/without provided src
   * @param {string} [src] - the source path of the script
   * @return {Object} - the created HTML script element
   */


  function createScript(src) {
    var script = document.createElement('script');
    return src && (script.src = src), script;
  }
  /**
   * creates an HTML script element with the monaco loader src
   * @return {Object} - the created HTML script element
   */


  function getMonacoLoaderScript(configureLoader) {
    var state = getState(function (_ref2) {
      var config = _ref2.config,
          reject = _ref2.reject;
      return {
        config: config,
        reject: reject
      };
    });
    var loaderScript = createScript("".concat(state.config.paths.vs, "/loader.js"));

    loaderScript.onload = function () {
      return configureLoader();
    };

    loaderScript.onerror = state.reject;
    return loaderScript;
  }
  /**
   * configures the monaco loader
   */


  function configureLoader() {
    var state = getState(function (_ref3) {
      var config = _ref3.config,
          resolve = _ref3.resolve,
          reject = _ref3.reject;
      return {
        config: config,
        resolve: resolve,
        reject: reject
      };
    });
    var require = window.require;

    require.config(state.config);

    require(['vs/editor/editor.main'], function (monaco) {
      storeMonacoInstance(monaco);
      state.resolve(monaco);
    }, function (error) {
      state.reject(error);
    });
  }
  /**
   * store monaco instance in local state
   */


  function storeMonacoInstance(monaco) {
    if (!getState().monaco) {
      setState({
        monaco: monaco
      });
    }
  }
  /**
   * internal helper function
   * extracts stored monaco instance
   * @return {Object|null} - the monaco instance
   */


  function __getMonacoInstance() {
    return getState(function (_ref4) {
      var monaco = _ref4.monaco;
      return monaco;
    });
  }

  var wrapperPromise = new Promise(function (resolve, reject) {
    return setState({
      resolve: resolve,
      reject: reject
    });
  });
  var loader = {
    config: config$1,
    init: init,
    __getMonacoInstance: __getMonacoInstance
  };

  return loader;

})));
