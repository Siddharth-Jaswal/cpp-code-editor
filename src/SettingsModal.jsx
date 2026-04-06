import { useEffect, useState } from 'react';
import { ChevronDown, FileJson2, Settings2, X } from 'lucide-react';
import { DEFAULT_SHORTCUTS, formatShortcutLabel, getShortcutFromEvent } from './shortcutUtils';
import { DEFAULT_EDITOR_SETTINGS } from './editorSettings';

function ShortcutField({ label, value, onChange }) {
  const [recording, setRecording] = useState(false);

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <button
        type="button"
        onClick={() => setRecording(true)}
        onKeyDown={(event) => {
          if (!recording) {
            return;
          }

          event.preventDefault();
          const shortcut = getShortcutFromEvent(event);
          if (!shortcut) {
            return;
          }

          onChange(shortcut);
          setRecording(false);
        }}
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-100"
      >
        {recording ? 'Press shortcut...' : formatShortcutLabel(value)}
      </button>
    </div>
  );
}

function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/40">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-200">{title}</span>
        <ChevronDown
          size={16}
          className={`text-slate-500 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="border-t border-slate-800 px-4 py-4">{children}</div> : null}
    </section>
  );
}

function SnippetRow({ snippet, onUpdate, onDelete }) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <input
        value={snippet.name}
        onChange={(event) => onUpdate({ ...snippet, name: event.target.value })}
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      />
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <textarea
          value={snippet.content}
          onChange={(event) => onUpdate({ ...snippet, content: event.target.value })}
          className="h-28 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
        />
        <button
          type="button"
          onClick={() => onDelete(snippet.id)}
          className="rounded-md border border-rose-900/60 px-3 py-2 text-xs uppercase tracking-[0.14em] text-rose-300"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function SettingsModal({
  open,
  onClose,
  shortcuts,
  onShortcutChange,
  settings,
  onSettingsChange,
  snippets,
  onUpdateSnippet,
  onDeleteSnippet,
  settingsFilePath,
  onOpenJsonSettings,
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-6 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <Settings2 size={18} className="text-slate-300" />
            <div>
              <div className="text-sm font-semibold text-slate-100">Settings</div>
              <div className="text-xs text-slate-500">Shortcuts, fonts, colors, templates, snippets</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenJsonSettings}
              className="rounded-md border border-slate-700 px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
              title={settingsFilePath}
            >
              <span className="inline-flex items-center gap-2">
                <FileJson2 size={15} />
                settings.json
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto px-5 py-5">
          <Section title="Shortcuts">
            <div className="space-y-4">
            <ShortcutField
              label="Run"
              value={shortcuts.run}
              onChange={(value) => onShortcutChange('run', value)}
            />
            <ShortcutField
              label="Save"
              value={shortcuts.save}
              onChange={(value) => onShortcutChange('save', value)}
            />
            <ShortcutField
              label="Save Snippet"
              value={shortcuts.saveSnippet}
              onChange={(value) => onShortcutChange('saveSnippet', value)}
            />
            <ShortcutField
              label="Insert Snippet"
              value={shortcuts.insertSnippet}
              onChange={(value) => onShortcutChange('insertSnippet', value)}
            />
            <ShortcutField
              label="Zoom In"
              value={shortcuts.zoomIn}
              onChange={(value) => onShortcutChange('zoomIn', value)}
            />
            <ShortcutField
              label="Zoom Out"
              value={shortcuts.zoomOut}
              onChange={(value) => onShortcutChange('zoomOut', value)}
            />
            <button
              type="button"
              onClick={() => {
                onSettingsChange(DEFAULT_EDITOR_SETTINGS);
                onShortcutChange('reset', DEFAULT_SHORTCUTS);
              }}
              className="rounded-md border border-slate-700 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300"
            >
              Reset Defaults
            </button>
            </div>
          </Section>

          <Section title="Editor">
            <div className="space-y-4">
            <label className="block space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Font Family</div>
              <input
                value={settings.fontFamily}
                onChange={(event) => onSettingsChange({ ...settings, fontFamily: event.target.value })}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <label className="block space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Font Size</div>
              <input
                type="number"
                min="12"
                max="28"
                value={settings.fontSize}
                onChange={(event) =>
                  onSettingsChange({ ...settings, fontSize: Number(event.target.value) || 14 })
                }
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <label className="block space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Editor Theme</div>
              <select
                value={settings.theme}
                onChange={(event) => onSettingsChange({ ...settings, theme: event.target.value })}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="vs-dark">Dark</option>
                <option value="light">Light</option>
                <option value="hc-black">High Contrast</option>
              </select>
            </label>
            <label className="block space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Accent Color</div>
              <input
                type="color"
                value={settings.accentColor}
                onChange={(event) => onSettingsChange({ ...settings, accentColor: event.target.value })}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-2"
              />
            </label>
            <label className="block space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Template</div>
              <textarea
                value={settings.template}
                onChange={(event) => onSettingsChange({ ...settings, template: event.target.value })}
                className="h-48 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
              />
            </label>
            </div>
          </Section>

          <Section title="Snippets">
            <div className="space-y-4">
            <div className="text-sm text-slate-500">
              Use the global `Save Snippet` shortcut to save the current selection.
              Use the global `Insert Snippet` shortcut to open a fuzzy-search picker.
            </div>
            <div className="text-sm text-slate-500">
              Snippets are managed here by name and content.
            </div>
            <div className="space-y-3">
              {snippets.length > 0 ? (
                snippets.map((snippet) => (
                  <SnippetRow
                    key={snippet.id}
                    snippet={snippet}
                    onUpdate={onUpdateSnippet}
                    onDelete={onDeleteSnippet}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-500">
                  No snippets yet.
                </div>
              )}
            </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
