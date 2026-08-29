import { Box, useColorMode } from "@chakra-ui/react";
import { forwardRef, useEffect, useRef } from "react";
import { monaco, jsonDefaults } from "./monaco";
import debounce from "lodash.debounce";
import { use } from "react";

const initHighlighter = async () => {
  const [shiki, shikiMonaco] = await Promise.all([import("./shiki"), import("@shikijs/monaco")]);
  shikiMonaco.shikiToMonaco(await shiki.highlighter, monaco);
};
const highlighterPromise = initHighlighter();
const schemaImportPromise = import("@gozargah/xray-schema/full/schema.json").then((m) => m.default);

// persits editor and node across mounts to preserve state and avoid costly reinitialization
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;
let editorNode: HTMLDivElement | null = null;
let schemaRegistered = false;

export type JSONEditorProps = {
  onChange: (value: string) => void;
  json: any;
  onSave?: () => void;
};

const initEditor = async (json: object, colorMode: "light" | "dark") => {
  return new Promise<void>((resolve) => {
    editorNode = document.createElement("div");
    const model =
      monaco.editor.getModel(monaco.Uri.parse("file:///config.json")) ??
      monaco.editor.createModel(JSON.stringify(json, null, 2), "json", monaco.Uri.parse("file:///config.json"));

    editorInstance = monaco.editor.create(editorNode, {
      model,
      language: "json",
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      padding: { top: 10, bottom: 10 },
      lineNumbersMinChars: 4.2,
      stickyScroll: { enabled: false },
      automaticLayout: true,
      quickSuggestions: { other: true, comments: false, strings: true },
      suggest: { showWords: false },
      tabSize: 2,
    });
    setTimeout(() => {
      initHighlighter();
      setTimeout(() => {
        monaco.editor.setTheme(colorMode === "light" ? "min-light" : "one-dark-pro");
        resolve();
      }, 10);
    }, 10);

    const saved = localStorage.getItem("viewState");
    if (saved) editorInstance.restoreViewState(JSON.parse(saved));
  });
};
const initializeEditorPromise = initEditor({}, "dark");

export const JsonEditor = forwardRef<HTMLDivElement, JSONEditorProps>(({ json, onChange, onSave }, ref) => {
  use(highlighterPromise);
  use(initializeEditorPromise);
  const schema = use(schemaImportPromise);
  const hostRef = useRef<HTMLDivElement>(null);
  const { colorMode } = useColorMode();

  useEffect(() => {
    const host = hostRef.current!;

    if (!schemaRegistered) {
      jsonDefaults.setDiagnosticsOptions({
        validate: true,
        schemas: [{ uri: "app://schema.json", fileMatch: ["*"], schema }],
      });
      schemaRegistered = true;
    }

    if (!editorNode) {
      editorNode = document.createElement("div");
    }

    host.appendChild(editorNode);

    if (editorInstance) {
      editorInstance.layout();
      monaco.editor.setTheme(colorMode === "light" ? "min-light" : "one-dark-pro");

      editorInstance.focus();

      const editor = editorInstance;

      const pasteDisposable = editor.onDidPaste(() => {
        editor.getModel() && editor.getAction("editor.action.formatDocument")?.run();
      });

      const contentDisposable = editor.getModel()?.onDidChangeContent(debounce(() => onChange(editor.getValue()), 100));

      if (onSave) {
        editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          onSave();
        });
      }

      return () => {
        pasteDisposable.dispose();
        contentDisposable?.dispose();
        editorNode?.remove();
      };
    }
  }, []);

  useEffect(() => {
    if (!editorInstance) return;
    const next = JSON.stringify(json, null, 2);
    if (editorInstance.getValue() !== next) {
      editorInstance.setValue(next);
    }
  }, [json]);

  useEffect(() => {
    monaco.editor.setTheme(colorMode === "light" ? "min-light" : "one-dark-pro");
  }, [colorMode]);

  return (
    <Box
      ref={hostRef}
      height="full"
      flexGrow={1}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      css={{ "& > div": { height: "100% !important", flexGrow: 1 } }}
      _light={{
        "&  .lines-content.monaco-editor-background": {
          bg: "#F9F9F9",
        },
        "& .margin-view-overlays": {
          bg: "#f6f6f6",
        },
        ".monaco-editor .view-overlays .current-line": {
          bg: "#f1f1f1 !important",
        },
      }}
      _dark={{
        "&  .lines-content.monaco-editor-background": {
          bg: "#1D2127",
        },
        "& .margin-view-overlays": {
          bg: "#1D2127",
        },
        ".monaco-editor .view-overlays .current-line": {
          bg: "#2b2f37 !important",
        },
      }}
    />
  );
});
