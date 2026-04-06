import { useEffect, useState } from 'react';
import { FileJson2, X } from 'lucide-react';

function JsonSettingsModal({ open, filePath, initialValue, onClose, onSave }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setValue(initialValue || '');
    setError('');
  }, [initialValue, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-6 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <FileJson2 size={18} className="text-slate-300" />
            <div>
              <div className="text-sm font-semibold text-slate-100">settings.json</div>
              <div className="text-xs text-slate-500">{filePath}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-5">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 font-mono text-sm text-slate-100"
            spellCheck={false}
          />
          {error ? <div className="text-sm text-rose-400">{error}</div> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-700 px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  setError('');
                  await onSave(value);
                } catch (saveError) {
                  setError(saveError.message || 'Failed to save settings.json');
                }
              }}
              className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950"
            >
              Save JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JsonSettingsModal;
