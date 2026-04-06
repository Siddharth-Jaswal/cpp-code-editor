import { useEffect, useState } from 'react';

function SnippetCaptureModal({ open, shortcut, onCancel, onSave }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setName('');
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
        <div className="text-sm font-semibold text-slate-100">Create Snippet</div>
        <div className="mt-1 text-sm text-slate-500">Shortcut: {shortcut}</div>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              return;
            }

            onSave(name.trim());
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Snippet name"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-700 px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950"
            >
              Save Snippet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SnippetCaptureModal;
