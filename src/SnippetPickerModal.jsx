import { useEffect, useMemo, useState } from 'react';

function scoreSnippetMatch(query, name) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedName = name.toLowerCase();

  if (!normalizedQuery) {
    return 1;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 100 - normalizedName.indexOf(normalizedQuery);
  }

  let score = 0;
  let queryIndex = 0;

  for (let index = 0; index < normalizedName.length && queryIndex < normalizedQuery.length; index += 1) {
    if (normalizedName[index] === normalizedQuery[queryIndex]) {
      score += 2;
      queryIndex += 1;
    }
  }

  return queryIndex === normalizedQuery.length ? score : 0;
}

function SnippetPickerModal({ open, snippets, onClose, onInsert }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredSnippets = useMemo(() => {
    return snippets
      .map((snippet) => ({
        snippet,
        score: scoreSnippetMatch(query, snippet.name),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.snippet.name.localeCompare(right.snippet.name))
      .map((entry) => entry.snippet);
  }, [query, snippets]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery('');
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, Math.max(filteredSnippets.length - 1, 0)));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === 'Enter' && filteredSnippets[activeIndex]) {
        event.preventDefault();
        onInsert(filteredSnippets[activeIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, filteredSnippets, onClose, onInsert, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
        <div className="text-sm font-semibold text-slate-100">Insert Snippet</div>
        <div className="mt-1 text-sm text-slate-500">Search snippets by name and press Enter to insert.</div>
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          placeholder="Type snippet name"
          className="mt-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
        <div className="mt-4 max-h-[50vh] space-y-2 overflow-auto">
          {filteredSnippets.length > 0 ? (
            filteredSnippets.map((snippet, index) => (
              <button
                key={snippet.id}
                type="button"
                onClick={() => onInsert(snippet)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  index === activeIndex
                    ? 'border-emerald-400 bg-slate-900'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-900'
                }`}
              >
                <div className="text-sm text-slate-100">{snippet.name}</div>
                <div className="mt-1 line-clamp-2 font-mono text-xs text-slate-500">
                  {snippet.content}
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-500">
              No snippets match your search.
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SnippetPickerModal;
