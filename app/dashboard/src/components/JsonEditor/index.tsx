import { draftFlushEvent } from "@/features/shared/drafts";
import { useTheme } from "@/components/theme-provider";
import { forwardRef, use, useEffect, useImperativeHandle, useRef } from "react";
import { monaco, jsonDefaults } from "./monaco";
import debounce from "lodash.debounce";

// Cache shared language resources, not mounted editors or their DOM/models.
const highlighterPromise = Promise.all([import("./shiki"), import("@shikijs/monaco")]).then(
  async ([shiki, shikiMonaco]) => shikiMonaco.shikiToMonaco(await shiki.highlighter, monaco),
);
const schemaImportPromise = import("@gozargah/xray-schema/full/schema.json").then((m) => m.default);
let schemaRegistered = false;

export type JSONEditorProps = {
  onChange: (value: string) => void;
  json: any;
  onSave?: () => void;
  ariaLabel?: string;
};

function formatJson(json: unknown) {
  return typeof json === "string" ? json : (JSON.stringify(json, null, 2) ?? "{}");
}

export const JsonEditor = forwardRef<HTMLDivElement, JSONEditorProps>(
  ({ json, onChange, onSave, ariaLabel = "JSON configuration" }, ref) => {
    use(highlighterPromise);
    const schema = use(schemaImportPromise);
    const hostRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const callbacks = useRef({ onChange, onSave });
    const initialJson = useRef(json);
    const { resolvedTheme } = useTheme();
    useImperativeHandle(ref, () => hostRef.current!, []);
    useEffect(() => {
      callbacks.current = { onChange, onSave };
    }, [onChange, onSave]);

    useEffect(() => {
      if (!schemaRegistered) {
        jsonDefaults.setDiagnosticsOptions({
          validate: true,
          schemas: [{ uri: "app://schema.json", fileMatch: ["*"], schema }],
        });
        schemaRegistered = true;
      }
      const model = monaco.editor.createModel(formatJson(initialJson.current), "json");
      const editor = monaco.editor.create(hostRef.current!, {
        model,
        ariaLabel,
        scrollBeyondLastLine: false,
        minimap: { enabled: false },
        padding: { top: 10, bottom: 10 },
        lineNumbersMinChars: 4,
        stickyScroll: { enabled: false },
        automaticLayout: true,
        quickSuggestions: { other: true, comments: false, strings: true },
        suggest: { showWords: false },
        tabSize: 2,
      });
      editorRef.current = editor;
      const notifyChange = debounce(() => callbacks.current.onChange(editor.getValue()), 100);
      const content = model.onDidChangeContent(() => notifyChange());
      const blur = editor.onDidBlurEditorWidget(() => notifyChange.flush());
      const paste = editor.onDidPaste(() => {
        void editor.getAction("editor.action.formatDocument")?.run();
      });
      const save = editor.addAction({
        id: "marzban.save-config",
        label: "Save configuration",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => {
          notifyChange.flush();
          callbacks.current.onSave?.();
        },
      });
      editor.focus();
      const flushDraft = () => notifyChange.flush();
      window.addEventListener(draftFlushEvent, flushDraft);
      return () => {
        window.removeEventListener(draftFlushEvent, flushDraft);
        notifyChange.cancel();
        content.dispose();
        blur.dispose();
        paste.dispose();
        save.dispose();
        editor.dispose();
        model.dispose();
        editorRef.current = null;
      };
    }, [schema]);

    useEffect(() => {
      const editor = editorRef.current;
      const next = formatJson(json);
      if (editor && editor.getValue() !== next) editor.setValue(next);
    }, [json]);
    useEffect(() => {
      editorRef.current?.updateOptions({ ariaLabel });
      monaco.editor.setTheme(resolvedTheme === "light" ? "min-light" : "one-dark-pro");
    }, [resolvedTheme, ariaLabel]);

    return <div ref={hostRef} className="h-full min-h-0 grow overflow-hidden" />;
  },
);
