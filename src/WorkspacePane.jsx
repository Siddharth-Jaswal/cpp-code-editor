import { useMemo, useState } from 'react';
import {
  FilePlus2,
  FolderPlus,
  FolderOpen,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
} from 'lucide-react';

function basename(filePath) {
  if (!filePath || filePath === '.') {
    return '';
  }

  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1];
}

function parentPathForSelection(selectedNode) {
  if (!selectedNode || selectedNode.path === '.') {
    return '.';
  }

  if (selectedNode.type === 'directory') {
    return selectedNode.path;
  }

  const parts = selectedNode.path.split(/[\\/]/);
  parts.pop();
  return parts.length > 0 ? parts.join('/') : '.';
}

function TreeNode({ node, depth, activeFilePath, selectedPath, onOpenFile, onSelectNode }) {
  const [expanded, setExpanded] = useState(false);
  const isDirectory = node.type === 'directory';
  const isActive = activeFilePath === node.path;
  const isSelected = selectedPath === node.path;

  if (isDirectory) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            onSelectNode(node);
            setExpanded((current) => !current);
          }}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
            isSelected ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-800/70'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <span className="w-3 text-slate-500">{expanded ? 'v' : '>'}</span>
          <span className="truncate">{node.name}</span>
        </button>
        {expanded
          ? node.children?.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFilePath={activeFilePath}
                selectedPath={selectedPath}
                onOpenFile={onOpenFile}
                onSelectNode={onSelectNode}
              />
            ))
          : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onSelectNode(node);
        onOpenFile(node.path);
      }}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
        isActive
          ? 'bg-emerald-500/15 text-emerald-300'
          : isSelected
            ? 'bg-slate-800 text-slate-100'
            : 'text-slate-300 hover:bg-slate-800/70'
      }`}
      style={{ paddingLeft: `${depth * 14 + 22}px` }}
    >
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function WorkspacePane({
  workspaceRoot,
  tree,
  activeFilePath,
  selectedNode,
  onSelectNode,
  onOpenFile,
  onCreateEntry,
  onRenameEntry,
  onDeleteEntry,
  onChooseWorkspace,
  onReloadWorkspace,
  onSetDefaultWorkspace,
  isDefaultWorkspace,
  statusMessage,
}) {
  const [entryMode, setEntryMode] = useState(null);
  const [entryName, setEntryName] = useState('');

  const rootLabel = useMemo(() => workspaceRoot || 'Workspace', [workspaceRoot]);
  const selectedLabel = selectedNode ? basename(selectedNode.path) || workspaceRoot : 'Workspace Root';

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!entryMode || !entryName.trim()) {
      return;
    }

    await onCreateEntry({
      type: entryMode,
      parentPath: parentPathForSelection(selectedNode),
      name: entryName.trim(),
    });

    setEntryName('');
    setEntryMode(null);
  };

  const handleRename = async (event) => {
    event.preventDefault();
    if (!selectedNode || !entryName.trim()) {
      return;
    }

    await onRenameEntry({
      path: selectedNode.path,
      name: entryName.trim(),
    });

    setEntryName('');
    setEntryMode(null);
  };

  return (
    <aside className="flex h-full min-w-0 flex-col border-r border-slate-800/80 bg-slate-950/60">
      <div className="border-b border-slate-800/80 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Workspace</div>
            <div className="mt-1 truncate text-sm text-slate-200">{rootLabel}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title={isDefaultWorkspace ? 'Default workspace' : 'Set as default workspace'}
              onClick={onSetDefaultWorkspace}
              className={`rounded-md border p-2 transition ${
                isDefaultWorkspace
                  ? 'border-amber-500/60 text-amber-300'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100'
              }`}
            >
              <Star size={15} fill={isDefaultWorkspace ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              title="Reload workspace"
              onClick={onReloadWorkspace}
              className="rounded-md border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              title="Open folder"
              onClick={onChooseWorkspace}
              className="rounded-md border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            >
              <FolderOpen size={15} />
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">Selected: {selectedLabel}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            title="New file"
            onClick={() => {
              setEntryMode('file');
              setEntryName('');
            }}
            className="rounded-md border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            <FilePlus2 size={15} />
          </button>
          <button
            type="button"
            title="New folder"
            onClick={() => {
              setEntryMode('directory');
              setEntryName('');
            }}
            className="rounded-md border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            <FolderPlus size={15} />
          </button>
          <button
            type="button"
            title="Rename"
            disabled={!selectedNode || selectedNode.path === '.'}
            onClick={() => {
              setEntryMode('rename');
              setEntryName(selectedNode ? basename(selectedNode.path) : '');
            }}
            className="rounded-md border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            title="Delete"
            disabled={!selectedNode || selectedNode.path === '.'}
            onClick={() => {
              if (!selectedNode || selectedNode.path === '.') {
                return;
              }

              if (window.confirm(`Delete ${basename(selectedNode.path)}?`)) {
                onDeleteEntry(selectedNode);
              }
            }}
            className="rounded-md border border-rose-900/60 p-2 text-rose-300 transition hover:border-rose-700 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {entryMode ? (
          <form
            onSubmit={entryMode === 'rename' ? handleRename : handleCreate}
            className="mt-3 space-y-2"
          >
            <input
              autoFocus
              value={entryName}
              onChange={(event) => setEntryName(event.target.value)}
              placeholder={
                entryMode === 'file' ? 'main.cpp' : entryMode === 'directory' ? 'src' : 'rename'
              }
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950"
              >
                {entryMode === 'rename' ? 'Rename' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryMode(null);
                  setEntryName('');
                }}
                className="rounded-md border border-slate-700 px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-300"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {statusMessage ? <div className="mt-3 text-xs text-slate-500">{statusMessage}</div> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {tree.length > 0 ? (
          tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              activeFilePath={activeFilePath}
              selectedPath={selectedNode?.path || '.'}
              onOpenFile={onOpenFile}
              onSelectNode={onSelectNode}
            />
          ))
        ) : (
          <div className="px-2 py-4 text-sm text-slate-500">Workspace is empty.</div>
        )}
      </div>
    </aside>
  );
}

export default WorkspacePane;
