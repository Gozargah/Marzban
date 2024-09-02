window.ace.define(
  "ace/theme/nord_dark",
  ["require", "exports", "module", "ace/lib/dom"],
  (acequire, exports, module) => {
    exports.isDark = true;
    exports.cssClass = "ace-nord-dark";
    const dom = acequire("../lib/dom");
    dom.importCssString(exports.cssText, exports.cssClass);
  }
);

window.ace.define(
  "ace/theme/dawn",
  ["require", "exports", "module", "ace/lib/dom"],
  (acequire, exports, module) => {
    exports.isDark = false;
    exports.cssClass = "ace-dawn";

    const dom = acequire("../lib/dom");
    dom.importCssString(exports.cssText, exports.cssClass);
  }
);
