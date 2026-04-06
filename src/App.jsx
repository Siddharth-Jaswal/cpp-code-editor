import { useEffect, useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import Editor from './Editor';
import JsonSettingsModal from './JsonSettingsModal';
import OutputPanel from './OutputPanel';
import SettingsModal from './SettingsModal';
import SnippetCaptureModal from './SnippetCaptureModal';
import SnippetPickerModal from './SnippetPickerModal';
import WorkspacePane from './WorkspacePane';
import { getShortcutFromEvent } from './shortcutUtils';
import { DEFAULT_EDITOR_SETTINGS } from './editorSettings';
import { DEFAULT_GLOBAL_SETTINGS, normalizeGlobalSettings } from './globalSettings';
import { createSnippetId } from './snippetUtils';

const MIN_HEADER_HEIGHT = 0;
const DEFAULT_HEADER_HEIGHT = 0;
const MAX_HEADER_HEIGHT = 140;
const DEFAULT_SIDEBAR_WIDTH = 0;
const MIN_SIDEBAR_WIDTH = 0;
const SIDEBAR_COLLAPSED_THRESHOLD = 80;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_OUTPUT_HEIGHT = 0;
const DEFAULT_OUTPUT_HEIGHT = 0;
const MAX_OUTPUT_HEIGHT_RATIO = 0.75;
const MIN_EDITOR_FONT_SIZE = 12;
const MAX_EDITOR_FONT_SIZE = 28;

function App() {
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('Ready');
  const [isRunning, setIsRunning] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [outputHeight, setOutputHeight] = useState(DEFAULT_OUTPUT_HEIGHT);
  const [shortcuts, setShortcuts] = useState(DEFAULT_GLOBAL_SETTINGS.shortcuts);
  const [editorSettings, setEditorSettings] = useState(DEFAULT_GLOBAL_SETTINGS.editor);
  const [snippets, setSnippets] = useState(DEFAULT_GLOBAL_SETTINGS.snippets);
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [workspaceTree, setWorkspaceTree] = useState([]);
  const [activeFilePath, setActiveFilePath] = useState('');
  const [selectedNode, setSelectedNode] = useState({ path: '.', type: 'directory', name: '' });
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [defaultWorkspacePath, setDefaultWorkspacePath] = useState('');
  const [bottomMode, setBottomMode] = useState('output');
  const [terminalOptions, setTerminalOptions] = useState([]);
  const [activeTerminal, setActiveTerminal] = useState(null);
  const [terminalSessionId, setTerminalSessionId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFilePath, setSettingsFilePath] = useState('');
  const [jsonSettingsOpen, setJsonSettingsOpen] = useState(false);
  const [jsonSettingsText, setJsonSettingsText] = useState('');
  const [pendingSnippet, setPendingSnippet] = useState(null);
  const [snippetPickerOpen, setSnippetPickerOpen] = useState(false);
  const latestRequestIdRef = useRef(0);
  const containerRef = useRef(null);
  const dragStateRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onCodeOutput((payload) => {
      if (payload.requestId !== latestRequestIdRef.current) {
        return;
      }

      if (payload.type === 'status') {
        setStatus(payload.status);
        return;
      }

      const sections = [];

      if (payload.stdout) {
        sections.push(payload.stdout.trimEnd());
      }

      if (payload.stderr) {
        sections.push(payload.stderr.trimEnd());
      }

      setOutput(sections.join('\n\n') || 'Program finished with no output.');
      setStatus(payload.success ? 'Completed' : `Failed during ${payload.phase}`);
      setIsRunning(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      if (terminalSessionId) {
        window.electronAPI.closeTerminal({ sessionId: terminalSessionId });
      }
    };
  }, [terminalSessionId]);

  useEffect(() => {
    const loadGlobalSettings = async () => {
      try {
        const result = await window.electronAPI.getGlobalSettings();
        const normalized = normalizeGlobalSettings(result.settings);
        setSettingsFilePath(result.path);
        setShortcuts(normalized.shortcuts);
        setEditorSettings(normalized.editor);
        setSnippets(normalized.snippets);
        setDefaultWorkspacePath(normalized.defaultWorkspacePath);
      } catch (error) {
        setWorkspaceMessage(error.message || 'Failed to load global settings.');
      }
    };

    loadGlobalSettings();
  }, []);

  useEffect(() => {
    if (!settingsFilePath) {
      return;
    }

    const saveGlobalSettings = async () => {
      try {
        await window.electronAPI.saveGlobalSettings({
          settings: {
            shortcuts,
            editor: editorSettings,
            snippets,
            defaultWorkspacePath,
          },
        });
      } catch {
      }
    };

    saveGlobalSettings();
  }, [defaultWorkspacePath, editorSettings, settingsFilePath, shortcuts, snippets]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const dragState = dragStateRef.current;
      if (!dragState || !containerRef.current) {
        return;
      }

      const bounds = containerRef.current.getBoundingClientRect();

      if (dragState.type === 'header') {
        const nextHeight = event.clientY - bounds.top;
        setHeaderHeight(Math.min(Math.max(nextHeight, MIN_HEADER_HEIGHT), MAX_HEADER_HEIGHT));
        return;
      }

      if (dragState.type === 'output') {
        const nextHeight = bounds.bottom - event.clientY;
        const maxHeight = Math.floor(bounds.height * MAX_OUTPUT_HEIGHT_RATIO);
        setOutputHeight(Math.min(Math.max(nextHeight, MIN_OUTPUT_HEIGHT), maxHeight));
        return;
      }

      if (dragState.type === 'sidebar') {
        const nextWidth = event.clientX - bounds.left;
        const clampedWidth = Math.min(Math.max(nextWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
        setSidebarWidth(clampedWidth <= SIDEBAR_COLLAPSED_THRESHOLD ? 0 : clampedWidth);
      }
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    refreshWorkspace();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (settingsOpen || pendingSnippet) {
        return;
      }

      const shortcut = getShortcutFromEvent(event);
      if (!shortcut) {
        return;
      }

      const consumeShortcut = () => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
      };

      if (shortcut === shortcuts.run) {
        consumeShortcut();
        handleRun();
        return;
      }

      if (shortcut === shortcuts.save) {
        consumeShortcut();
        handleSaveFile();
        return;
      }

      if (shortcut === shortcuts.saveSnippet) {
        consumeShortcut();

        if (!activeFilePath) {
          setWorkspaceMessage('Open a file before saving a snippet.');
          return;
        }

        const selectedText = getSelectedEditorText();
        if (!selectedText) {
          setWorkspaceMessage('Select code before saving a snippet.');
          return;
        }

        setPendingSnippet({
          shortcut,
          content: selectedText,
        });
        return;
      }

      if (shortcut === shortcuts.insertSnippet) {
        consumeShortcut();
        setSnippetPickerOpen(true);
        return;
      }

      if (shortcut === shortcuts.zoomIn) {
        consumeShortcut();
        setEditorSettings((current) => ({
          ...current,
          fontSize: Math.min(current.fontSize + 1, MAX_EDITOR_FONT_SIZE),
        }));
        return;
      }

      if (shortcut === shortcuts.zoomOut) {
        consumeShortcut();
        setEditorSettings((current) => ({
          ...current,
          fontSize: Math.max(current.fontSize - 1, MIN_EDITOR_FONT_SIZE),
        }));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeFilePath, code, isRunning, pendingSnippet, settingsOpen, shortcuts]);

  const handleRun = () => {
    if (isRunning) {
      return;
    }

    const requestId = Date.now();
    latestRequestIdRef.current = requestId;
    setOutput('');
    setStatus('Compiling...');
    setIsRunning(true);
    window.electronAPI.runCode({ code, requestId });
  };

  const startHeaderResize = (event) => {
    event.preventDefault();
    dragStateRef.current = { type: 'header' };
  };

  const startOutputResize = (event) => {
    event.preventDefault();
    dragStateRef.current = { type: 'output' };
  };

  const startSidebarResize = (event) => {
    event.preventDefault();
    dragStateRef.current = { type: 'sidebar' };
  };

  async function refreshWorkspace() {
    try {
      const workspace = await window.electronAPI.getWorkspace();
      setWorkspaceRoot(workspace.rootPath);
      setWorkspaceTree(workspace.tree);
      setSelectedNode({ path: '.', type: 'directory', name: '' });
    } catch (error) {
      setWorkspaceMessage(error.message || 'Failed to load workspace.');
    }
  }

  useEffect(() => {
    if (!defaultWorkspacePath) {
      return;
    }

    let cancelled = false;

    const loadDefaultWorkspace = async () => {
      try {
        const workspace = await window.electronAPI.openWorkspaceDirectory({ path: defaultWorkspacePath });
        if (cancelled) {
          return;
        }

        setWorkspaceRoot(workspace.rootPath);
        setWorkspaceTree(workspace.tree);
        setSelectedNode({ path: '.', type: 'directory', name: '' });
        setWorkspaceMessage(`Opened default workspace ${workspace.rootPath}`);
      } catch {
        if (!cancelled) {
          setWorkspaceMessage('Saved default workspace could not be opened.');
        }
      }
    };

    loadDefaultWorkspace();

    return () => {
      cancelled = true;
    };
  }, [defaultWorkspacePath]);

  const handleChooseWorkspace = async () => {
    try {
      const result = await window.electronAPI.chooseWorkspaceDirectory();
      if (result.canceled) {
        return;
      }

      setWorkspaceRoot(result.rootPath);
      setWorkspaceTree(result.tree || []);
      setActiveFilePath('');
      setSelectedNode({ path: '.', type: 'directory', name: '' });
      setCode('');
      setWorkspaceMessage(`Opened workspace ${result.rootPath}`);
    } catch (error) {
      setWorkspaceMessage(error.message || 'Failed to open folder.');
    }
  };

  const handleSetDefaultWorkspace = () => {
    if (!workspaceRoot) {
      return;
    }

    setDefaultWorkspacePath(workspaceRoot);
    setWorkspaceMessage(`Default workspace set to ${workspaceRoot}`);
  };

  const handleOpenFile = async (filePath) => {
    try {
      const file = await window.electronAPI.readWorkspaceFile({ path: filePath });
      setCode(file.content);
      setActiveFilePath(file.path);
      setSelectedNode({
        path: file.path,
        type: 'file',
        name: file.path.split(/[\\/]/).pop() || file.path,
      });
      setWorkspaceMessage(`Opened ${file.path}`);
    } catch (error) {
      setWorkspaceMessage(error.message || 'Failed to open file.');
    }
  };

  const handleSaveFile = async () => {
    if (!activeFilePath) {
      setWorkspaceMessage('Open or create a file before saving.');
      return;
    }

    try {
      await window.electronAPI.writeWorkspaceFile({
        path: activeFilePath,
        content: code,
      });
      setWorkspaceMessage(`Saved ${activeFilePath}`);
    } catch (error) {
      setWorkspaceMessage(error.message || 'Failed to save file.');
    }
  };

  const handleCreateEntry = async ({ type, parentPath, name }) => {
    try {
      const result = await window.electronAPI.createWorkspaceEntry({
        type,
        parentPath,
        name,
      });
      await refreshWorkspace();
      setWorkspaceMessage(`${type === 'directory' ? 'Created folder' : 'Created file'} ${result.path}`);

      if (type === 'file') {
        await handleOpenFile(result.path);
      } else {
        setSelectedNode({
          path: result.path,
          type: 'directory',
          name: result.path.split(/[\\/]/).pop() || result.path,
        });
      }
    } catch (error) {
      setWorkspaceMessage(error.message || 'Failed to create entry.');
    }
  };

  const handleRenameEntry = async ({ path, name }) => {
    try {
      const result = await window.electronAPI.renameWorkspaceEntry({ path, name });
      await refreshWorkspace();
      setWorkspaceMessage(`Renamed to ${result.path}`);

      if (activeFilePath === path) {
        setActiveFilePath(result.path);
      }

      setSelectedNode({
        path: result.path,
        type: selectedNode?.type || 'file',
        name,
      });
    } catch (error) {
      setWorkspaceMessage(error.message || 'Failed to rename entry.');
    }
  };

  const handleDeleteEntry = async (node) => {
    try {
      await window.electronAPI.deleteWorkspaceEntry({ path: node.path });
      await refreshWorkspace();
      setWorkspaceMessage(`Deleted ${node.path}`);

      if (activeFilePath === node.path) {
        setActiveFilePath('');
        setCode('');
      }

      setSelectedNode({ path: '.', type: 'directory', name: '' });
    } catch (error) {
      setWorkspaceMessage(error.message || 'Failed to delete entry.');
    }
  };

  const refreshTerminals = async () => {
    try {
      const terminals = await window.electronAPI.listTerminals();
      setTerminalOptions(terminals);
    } catch {
      setTerminalOptions([]);
    }
  };

  const handleOpenTerminal = (terminal) => {
    const sessionId = `${terminal.id}-${Date.now()}`;

    if (terminalSessionId) {
      window.electronAPI.closeTerminal({ sessionId: terminalSessionId });
    }

    setTerminalSessionId(sessionId);
    setActiveTerminal({ id: terminal.id, label: terminal.label });
    setBottomMode('terminal');
    window.electronAPI.openTerminal({
      terminalId: terminal.id,
      sessionId,
      cols: 100,
      rows: 24,
    });
  };

  const handleInsertTemplate = () => {
    setCode(editorSettings.template);
    if (activeFilePath) {
      setWorkspaceMessage(`Inserted template into ${activeFilePath}`);
    }
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  const getSelectedEditorText = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) {
      return '';
    }

    const selection = editor.getSelection();
    const model = editor.getModel();
    if (!selection || !model || selection.isEmpty()) {
      return '';
    }

    return model.getValueInRange(selection);
  };

  const insertSnippet = (snippetContent) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeFilePath) {
      return;
    }

    const selection = editor.getSelection();
    const range = selection || new monaco.Range(1, 1, 1, 1);
    editor.executeEdits('snippet-insert', [
      {
        range,
        text: snippetContent,
        forceMoveMarkers: true,
      },
    ]);
    editor.focus();
    setCode(editor.getValue());
  };

  const handleSavePendingSnippet = (name) => {
    if (!pendingSnippet) {
      return;
    }

    setSnippets((current) => [
      ...current,
      {
        id: createSnippetId(),
        name,
        content: pendingSnippet.content,
      },
    ]);
    setWorkspaceMessage(`Snippet ${name} saved`);
    setPendingSnippet(null);
  };

  const handleUpdateSnippet = (updatedSnippet) => {
    setSnippets((current) =>
      current.map((snippet) => (snippet.id === updatedSnippet.id ? updatedSnippet : snippet))
    );
  };

  const handleDeleteSnippet = (snippetId) => {
    setSnippets((current) => current.filter((snippet) => snippet.id !== snippetId));
  };

  const handleOpenJsonSettings = async () => {
    try {
      const result = await window.electronAPI.readGlobalSettingsRaw();
      setSettingsFilePath(result.path);
      setJsonSettingsText(result.raw);
      setJsonSettingsOpen(true);
    } catch (error) {
      setWorkspaceMessage(error.message || 'Failed to open settings.json');
    }
  };

  const handleSaveJsonSettings = async (rawValue) => {
    const result = await window.electronAPI.writeGlobalSettingsRaw({ raw: rawValue });
    const normalized = normalizeGlobalSettings(result.settings);
    setSettingsFilePath(result.path);
    setShortcuts(normalized.shortcuts);
    setEditorSettings(normalized.editor);
    setSnippets(normalized.snippets);
    setDefaultWorkspacePath(normalized.defaultWorkspacePath);
    setJsonSettingsText(JSON.stringify(normalized, null, 2));
    setJsonSettingsOpen(false);
    setWorkspaceMessage('Saved settings.json');
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100"
      style={{ ['--accent-color']: editorSettings.accentColor }}
    >
      {headerHeight > 0 ? (
        <header
          className="flex justify-end overflow-hidden border-b border-slate-800/80 bg-slate-950/70 px-4 backdrop-blur"
          style={{ height: `${headerHeight}px` }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-md border border-slate-700 p-2 text-slate-200 transition hover:border-slate-500 hover:bg-slate-900/70"
              title="Settings"
            >
              <Settings2 size={16} />
            </button>
            <button
              type="button"
              onClick={handleSaveFile}
              className="rounded-md border border-slate-700 px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-200 transition hover:border-slate-500 hover:bg-slate-900/70"
            >
              Save
            </button>
            <div className="min-w-[180px] rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isRunning ? 'bg-amber-400' : status.startsWith('Failed') ? 'bg-rose-400' : ''
                  }`}
                  style={!isRunning && !status.startsWith('Failed') ? { backgroundColor: editorSettings.accentColor } : undefined}
                />
                <span className="text-sm text-slate-200">{status}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRun}
              disabled={isRunning}
              className="rounded-md px-4 py-2 text-sm font-medium uppercase tracking-[0.08em] text-slate-950 transition disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              style={{ backgroundColor: editorSettings.accentColor }}
            >
              Run
            </button>
          </div>
        </header>
      ) : null}

      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={startHeaderResize}
        className={`group flex items-center justify-center px-3 ${headerHeight > 0 ? 'h-4' : 'h-6 pt-2'}`}
      >
        <div className="flex w-full cursor-row-resize items-center justify-center">
          <div className="h-1 w-20 rounded-full bg-slate-700 transition group-hover:bg-emerald-400" />
        </div>
      </div>

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 px-3 pb-0 pt-3">
          <div className="flex h-full overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/70 shadow-[0_18px_50px_rgba(15,23,42,0.45)]">
            {sidebarWidth > 0 ? (
              <>
                <div style={{ width: `${sidebarWidth}px` }} className="min-w-0">
                  <WorkspacePane
                    workspaceRoot={workspaceRoot}
                    tree={workspaceTree}
                    activeFilePath={activeFilePath}
                    selectedNode={selectedNode}
                    onSelectNode={setSelectedNode}
                    onOpenFile={handleOpenFile}
                    onCreateEntry={handleCreateEntry}
                    onRenameEntry={handleRenameEntry}
                    onDeleteEntry={handleDeleteEntry}
                    onChooseWorkspace={handleChooseWorkspace}
                    onReloadWorkspace={refreshWorkspace}
                    onSetDefaultWorkspace={handleSetDefaultWorkspace}
                    isDefaultWorkspace={workspaceRoot === defaultWorkspacePath}
                    statusMessage={workspaceMessage}
                  />
                </div>

                <div
                  role="separator"
                  aria-orientation="vertical"
                  onPointerDown={startSidebarResize}
                  className="group flex w-4 cursor-col-resize items-center justify-center"
                >
                  <div className="h-16 w-1 rounded-full bg-slate-700 transition group-hover:bg-emerald-400" />
                </div>
              </>
            ) : (
              <div className="flex w-6 items-start justify-center pt-3">
                <button
                  type="button"
                  onPointerDown={startSidebarResize}
                  className="flex h-20 w-3 cursor-col-resize items-center justify-center rounded-full bg-slate-800 transition hover:bg-emerald-500/70"
                  aria-label="Resize workspace pane"
                >
                  <span className="h-10 w-1 rounded-full bg-slate-500" />
                </button>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <Editor
                code={code}
                onChange={setCode}
                fontSize={editorSettings.fontSize}
                fontFamily={editorSettings.fontFamily}
                theme={editorSettings.theme}
                activeFilePath={activeFilePath}
                onInsertTemplate={handleInsertTemplate}
                accentColor={editorSettings.accentColor}
                onMountEditor={handleEditorMount}
              />
            </div>
          </div>
        </div>

        <div
          role="separator"
          aria-orientation="horizontal"
          onPointerDown={startOutputResize}
          className="group flex h-6 items-center justify-center px-3"
        >
          <div className="flex w-full cursor-row-resize items-center justify-center">
            <div className="h-1 w-24 rounded-full bg-slate-700 transition group-hover:bg-emerald-400" />
          </div>
        </div>

        {outputHeight > 0 ? (
          <div className="px-3 pb-3" style={{ height: `${outputHeight}px` }}>
            <div className="h-full overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/85 shadow-[0_18px_50px_rgba(15,23,42,0.45)]">
              <OutputPanel
                output={output}
                bottomMode={bottomMode}
                onModeChange={setBottomMode}
                terminalOptions={terminalOptions}
                onRefreshTerminals={refreshTerminals}
                onOpenTerminal={handleOpenTerminal}
                activeTerminal={activeTerminal}
                terminalSessionId={terminalSessionId}
                onTerminalReady={setActiveTerminal}
              />
            </div>
          </div>
        ) : null}
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        shortcuts={shortcuts}
        onShortcutChange={(key, value) => {
          if (key === 'reset') {
            setShortcuts(value);
            return;
          }

          setShortcuts((current) => ({
            ...current,
            [key]: value,
          }));
        }}
        settings={editorSettings}
        onSettingsChange={(value) => {
          setEditorSettings((current) => ({
            ...current,
            ...value,
            fontSize: Math.min(Math.max(value.fontSize ?? current.fontSize, MIN_EDITOR_FONT_SIZE), MAX_EDITOR_FONT_SIZE),
          }));
        }}
        snippets={snippets}
        onUpdateSnippet={handleUpdateSnippet}
        onDeleteSnippet={handleDeleteSnippet}
        settingsFilePath={settingsFilePath}
        onOpenJsonSettings={handleOpenJsonSettings}
      />

      <SnippetCaptureModal
        open={Boolean(pendingSnippet)}
        shortcut={pendingSnippet?.shortcut || ''}
        onCancel={() => setPendingSnippet(null)}
        onSave={handleSavePendingSnippet}
      />

      <SnippetPickerModal
        open={snippetPickerOpen}
        snippets={snippets}
        onClose={() => setSnippetPickerOpen(false)}
        onInsert={(snippet) => {
          insertSnippet(snippet.content);
          setSnippetPickerOpen(false);
        }}
      />

      <JsonSettingsModal
        open={jsonSettingsOpen}
        filePath={settingsFilePath}
        initialValue={jsonSettingsText}
        onClose={() => setJsonSettingsOpen(false)}
        onSave={handleSaveJsonSettings}
      />
    </div>
  );
}

export default App;
