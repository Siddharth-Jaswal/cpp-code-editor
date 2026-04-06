import MonacoEditor from '@monaco-editor/react';

function Editor({
  code,
  onChange,
  fontSize,
  fontFamily,
  theme,
  activeFilePath,
  onInsertTemplate,
  accentColor,
  onMountEditor,
}) {
  if (!activeFilePath) {
    return (
      <section className="flex h-full items-center justify-center bg-slate-950/40">
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-6 py-8 text-center shadow-2xl">
          <div className="text-sm uppercase tracking-[0.24em] text-slate-500">Editor</div>
          <div className="mt-3 text-lg text-slate-100">Open a file to start editing</div>
          <div className="mt-2 text-sm text-slate-500">
            Create a file from the workspace pane, then optionally insert your template.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-0 h-full">
      {!code ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="pointer-events-auto rounded-xl border border-slate-800 bg-slate-950/90 px-5 py-4 text-center shadow-2xl">
            <div className="text-sm text-slate-200">This file is empty.</div>
            <button
              type="button"
              onClick={onInsertTemplate}
              className="mt-3 rounded-md px-3 py-2 text-sm font-medium text-slate-950 transition"
              style={{ backgroundColor: accentColor }}
            >
              Insert Template
            </button>
          </div>
        </div>
      ) : null}
      <MonacoEditor
        height="100%"
        defaultLanguage="cpp"
        value={code}
        theme={theme}
        onMount={onMountEditor}
        onChange={(value) => onChange(value ?? '')}
        options={{
          automaticLayout: true,
          fontSize,
          fontFamily,
          minimap: { enabled: false },
          padding: { top: 16 },
          scrollBeyondLastLine: false,
        }}
      />
    </section>
  );
}

export default Editor;
