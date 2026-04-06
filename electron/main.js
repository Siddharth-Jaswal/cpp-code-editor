const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const { execFile } = require('child_process');
const pty = require('node-pty');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const isDev = !app.isPackaged;
const RUN_TIMEOUT_MS = 10000;
const terminalSessions = new Map();
const launchDirectory = process.cwd();
let workspaceRoot = launchDirectory;
const ignoredWorkspaceEntries = new Set(['.git', 'node_modules', 'dist']);

const DEFAULT_GLOBAL_SETTINGS = {
  shortcuts: {
    run: 'Ctrl+N',
    save: 'Ctrl+S',
    saveSnippet: 'Ctrl+Alt+S',
    insertSnippet: 'Ctrl+Alt+I',
    zoomIn: 'Ctrl+=',
    zoomOut: 'Ctrl+-',
  },
  editor: {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 14,
    theme: 'vs-dark',
    accentColor: '#22c55e',
    template: `#include <iostream>
using namespace std;

int main() {
  cout << "Hello World";
  return 0;
}
`,
  },
  snippets: [],
  defaultWorkspacePath: '',
};

function sendToRenderer(webContents, channel, payload) {
  if (!webContents.isDestroyed()) {
    webContents.send(channel, payload);
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    icon: path.join(__dirname, "assets/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function createTempPaths(tempDir) {
  const sourceFile = path.join(tempDir, 'temp.cpp');
  const executableName = process.platform === 'win32' ? 'temp.exe' : 'temp';
  const executablePath = path.join(tempDir, executableName);

  return { sourceFile, executablePath };
}

function ensureWithinWorkspace(targetPath) {
  const resolvedPath = path.resolve(workspaceRoot, targetPath || '.');
  const normalizedRoot = path.resolve(workspaceRoot);

  if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error('Path is outside the workspace.');
  }

  return resolvedPath;
}

function getWorkspaceRoot() {
  return workspaceRoot;
}

function getSettingsFilePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function normalizeGlobalSettings(settings) {
  return {
    shortcuts: {
      ...DEFAULT_GLOBAL_SETTINGS.shortcuts,
      ...(settings?.shortcuts || {}),
    },
    editor: {
      ...DEFAULT_GLOBAL_SETTINGS.editor,
      ...(settings?.editor || {}),
    },
    snippets: Array.isArray(settings?.snippets) ? settings.snippets : [],
    defaultWorkspacePath:
      typeof settings?.defaultWorkspacePath === 'string' ? settings.defaultWorkspacePath : '',
  };
}

async function readGlobalSettings() {
  try {
    const raw = await fs.readFile(getSettingsFilePath(), 'utf8');
    return normalizeGlobalSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_GLOBAL_SETTINGS;
  }
}

async function writeGlobalSettings(settings) {
  const normalized = normalizeGlobalSettings(settings);
  await fs.mkdir(path.dirname(getSettingsFilePath()), { recursive: true });
  await fs.writeFile(getSettingsFilePath(), JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

async function openWorkspaceDirectory(directoryPath) {
  const resolvedPath = path.resolve(directoryPath);
  const stats = await fs.stat(resolvedPath);

  if (!stats.isDirectory()) {
    throw new Error('Selected path is not a directory.');
  }

  workspaceRoot = resolvedPath;
  const tree = await buildFileTree(getWorkspaceRoot());

  return {
    rootPath: getWorkspaceRoot(),
    tree,
  };
}

async function buildFileTree(currentPath) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const filteredEntries = entries.filter((entry) => !ignoredWorkspaceEntries.has(entry.name));
  const sortedEntries = filteredEntries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) {
      return a.isDirectory() ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });

  return Promise.all(
    sortedEntries.map(async (entry) => {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(getWorkspaceRoot(), absolutePath) || '.';

      if (entry.isDirectory()) {
        return {
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children: await buildFileTree(absolutePath),
        };
      }

      return {
        name: entry.name,
        path: relativePath,
        type: 'file',
      };
    })
  );
}

function getTerminalCandidates() {
  if (process.platform === 'win32') {
    return [
      { id: 'powershell', label: 'PowerShell', command: 'powershell.exe', args: [] },
      { id: 'pwsh', label: 'PowerShell 7', command: 'pwsh.exe', args: [] },
      { id: 'cmd', label: 'Command Prompt', command: 'cmd.exe', args: [] },
      {
        id: 'git-bash',
        label: 'Git Bash',
        command: 'C:\\Program Files\\Git\\bin\\bash.exe',
        args: ['--login', '-i'],
      },
    ];
  }

  return [
    { id: 'bash', label: 'Bash', command: 'bash', args: ['-i'] },
    { id: 'zsh', label: 'Zsh', command: 'zsh', args: ['-i'] },
    { id: 'sh', label: 'Sh', command: 'sh', args: ['-i'] },
  ];
}

async function commandExists(command) {
  try {
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';
    await execFileAsync(checkCommand, [command], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

async function listAvailableTerminals() {
  const candidates = getTerminalCandidates();
  const available = [];

  for (const terminal of candidates) {
    const exists = terminal.command.includes(path.sep)
      ? await fs
          .access(terminal.command)
          .then(() => true)
          .catch(() => false)
      : await commandExists(terminal.command);

    if (exists) {
      available.push(terminal);
    }
  }

  return available;
}

function getShellCwd() {
  return getWorkspaceRoot();
}

function attachTerminalSession(webContents, sessionId, terminalProcess) {
  terminalProcess.onData((data) => {
    sendToRenderer(webContents, 'terminal-data', {
      type: 'terminal-data',
      sessionId,
      data,
    });
  });

  terminalProcess.onExit(({ exitCode }) => {
    terminalSessions.delete(sessionId);
    sendToRenderer(webContents, 'terminal-exit', {
      type: 'terminal-exit',
      sessionId,
      code: exitCode,
    });
  });
}

function disposeTerminalSession(sessionId) {
  const session = terminalSessions.get(sessionId);
  if (!session) {
    return;
  }

  session.process.kill();
  terminalSessions.delete(sessionId);
}

function formatProcessError(error, phase) {
  const command = error?.cmd || '';
  const stderr = error?.stderr || '';
  const stdout = error?.stdout || '';
  const timedOut = error?.killed && error?.signal === 'SIGTERM';
  const missingCompiler = phase === 'compile' && error?.code === 'ENOENT';

  return {
    success: false,
    phase,
    stdout,
    stderr: missingCompiler
      ? 'g++ was not found in PATH. Install a C++ compiler and make sure g++ is available.'
      : timedOut
        ? `Process timed out after ${RUN_TIMEOUT_MS / 1000} seconds.`
        : stderr || command || error?.message || 'Unknown error',
  };
}

async function compileCpp(sourceFile, executablePath, tempDir) {
  try {
    await execFileAsync('g++', [sourceFile, '-o', executablePath], {
      cwd: tempDir,
      windowsHide: true,
      timeout: RUN_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });

    return { success: true };
  } catch (error) {
    return formatProcessError(error, 'compile');
  }
}

async function runExecutable(executablePath, tempDir) {
  try {
    const { stdout, stderr } = await execFileAsync(executablePath, [], {
      cwd: tempDir,
      windowsHide: true,
      timeout: RUN_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });

    return {
      success: true,
      phase: 'run',
      stdout: stdout || '',
      stderr: stderr || '',
    };
  } catch (error) {
    return formatProcessError(error, 'run');
  }
}

ipcMain.on('run-code', async (event, payload) => {
  const code = payload?.code;
  const requestId = payload?.requestId;

  if (typeof code !== 'string' || !code.trim()) {
    sendToRenderer(event.sender, 'code-output', {
      requestId,
      success: false,
      phase: 'compile',
      stdout: '',
      stderr: 'No C++ code provided.',
    });
    return;
  }

  sendToRenderer(event.sender, 'code-output', {
    requestId,
    type: 'status',
    status: 'Compiling...',
  });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-editor-'));
  const { sourceFile, executablePath } = createTempPaths(tempDir);

  try {
    await fs.writeFile(sourceFile, code, 'utf8');

    const compileResult = await compileCpp(sourceFile, executablePath, tempDir);
    if (!compileResult.success) {
      sendToRenderer(event.sender, 'code-output', { requestId, ...compileResult });
      return;
    }

    sendToRenderer(event.sender, 'code-output', {
      requestId,
      type: 'status',
      status: 'Running...',
    });

    const runResult = await runExecutable(executablePath, tempDir);
    sendToRenderer(event.sender, 'code-output', { requestId, ...runResult });
  } catch (error) {
    sendToRenderer(event.sender, 'code-output', {
      requestId,
      success: false,
      phase: 'compile',
      stdout: '',
      stderr: error?.message || 'Unexpected error while preparing the run.',
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

ipcMain.handle('list-terminals', async () => {
  const terminals = await listAvailableTerminals();
  return terminals.map(({ id, label, command, args }) => ({ id, label, command, args }));
});

ipcMain.on('open-terminal', async (event, payload) => {
  const terminalId = payload?.terminalId;
  const sessionId = payload?.sessionId;
  const terminals = await listAvailableTerminals();
  const selectedTerminal = terminals.find((terminal) => terminal.id === terminalId);

  if (!selectedTerminal || !sessionId) {
    sendToRenderer(event.sender, 'terminal-error', {
      type: 'terminal-error',
      sessionId,
      error: 'Unable to open the selected terminal.',
    });
    return;
  }

  disposeTerminalSession(sessionId);

  try {
    const terminalProcess = pty.spawn(selectedTerminal.command, selectedTerminal.args, {
      cwd: getShellCwd(),
      env: process.env,
      cols: payload?.cols || 100,
      rows: payload?.rows || 24,
      name: 'xterm-color',
    });

    terminalSessions.set(sessionId, {
      process: terminalProcess,
      terminalId,
    });

    attachTerminalSession(event.sender, sessionId, terminalProcess);

    sendToRenderer(event.sender, 'terminal-opened', {
      type: 'terminal-opened',
      sessionId,
      terminal: {
        id: selectedTerminal.id,
        label: selectedTerminal.label,
      },
    });
  } catch (error) {
    sendToRenderer(event.sender, 'terminal-error', {
      type: 'terminal-error',
      sessionId,
      error: error?.message || 'Failed to open terminal.',
    });
  }
});

ipcMain.on('terminal-input', (_event, payload) => {
  const sessionId = payload?.sessionId;
  const input = payload?.input;
  const session = terminalSessions.get(sessionId);

  if (!session || typeof input !== 'string') {
    return;
  }

  session.process.write(input);
});

ipcMain.on('resize-terminal', (_event, payload) => {
  const sessionId = payload?.sessionId;
  const cols = payload?.cols;
  const rows = payload?.rows;
  const session = terminalSessions.get(sessionId);

  if (!session || !Number.isFinite(cols) || !Number.isFinite(rows)) {
    return;
  }

  session.process.resize(cols, rows);
});

ipcMain.on('close-terminal', (_event, payload) => {
  disposeTerminalSession(payload?.sessionId);
});

ipcMain.handle('get-workspace', async () => {
  const tree = await buildFileTree(getWorkspaceRoot());
  return {
    rootPath: getWorkspaceRoot(),
    tree,
  };
});

ipcMain.handle('read-workspace-file', async (_event, payload) => {
  const filePath = ensureWithinWorkspace(payload?.path);
  const content = await fs.readFile(filePath, 'utf8');

  return {
    path: path.relative(getWorkspaceRoot(), filePath),
    content,
  };
});

ipcMain.handle('write-workspace-file', async (_event, payload) => {
  const filePath = ensureWithinWorkspace(payload?.path);
  await fs.writeFile(filePath, payload?.content ?? '', 'utf8');
  return { ok: true };
});

ipcMain.handle('create-workspace-entry', async (_event, payload) => {
  const parentPath = ensureWithinWorkspace(payload?.parentPath || '.');
  const entryName = String(payload?.name || '').trim();

  if (!entryName || entryName.includes('/') || entryName.includes('\\')) {
    throw new Error('Invalid file or folder name.');
  }

  const entryPath = path.join(parentPath, entryName);

  if (payload?.type === 'directory') {
    await fs.mkdir(entryPath, { recursive: false });
  } else {
    await fs.writeFile(entryPath, '', { flag: 'wx' });
  }

  return {
    path: path.relative(getWorkspaceRoot(), entryPath),
  };
});

ipcMain.handle('rename-workspace-entry', async (_event, payload) => {
  const sourcePath = ensureWithinWorkspace(payload?.path);
  const nextName = String(payload?.name || '').trim();

  if (!nextName || nextName.includes('/') || nextName.includes('\\')) {
    throw new Error('Invalid file or folder name.');
  }

  const targetPath = path.join(path.dirname(sourcePath), nextName);
  ensureWithinWorkspace(path.relative(getWorkspaceRoot(), targetPath));
  await fs.rename(sourcePath, targetPath);

  return {
    path: path.relative(getWorkspaceRoot(), targetPath),
  };
});

ipcMain.handle('delete-workspace-entry', async (_event, payload) => {
  const entryPath = ensureWithinWorkspace(payload?.path);
  await fs.rm(entryPath, { recursive: true, force: true });
  return { ok: true };
});

ipcMain.handle('choose-workspace-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open Folder',
    defaultPath: getWorkspaceRoot(),
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return {
      canceled: true,
      rootPath: getWorkspaceRoot(),
    };
  }

  const workspace = await openWorkspaceDirectory(result.filePaths[0]);

  return {
    canceled: false,
    rootPath: workspace.rootPath,
    tree: workspace.tree,
  };
});

ipcMain.handle('open-workspace-directory', async (_event, payload) => {
  const directoryPath = String(payload?.path || '').trim();
  if (!directoryPath) {
    throw new Error('No workspace path provided.');
  }

  return openWorkspaceDirectory(directoryPath);
});

ipcMain.handle('get-global-settings', async () => {
  const settings = await readGlobalSettings();
  return {
    path: getSettingsFilePath(),
    settings,
  };
});

ipcMain.handle('save-global-settings', async (_event, payload) => {
  const settings = await writeGlobalSettings(payload?.settings || {});
  return {
    path: getSettingsFilePath(),
    settings,
  };
});

ipcMain.handle('read-global-settings-raw', async () => {
  try {
    const raw = await fs.readFile(getSettingsFilePath(), 'utf8');
    return {
      path: getSettingsFilePath(),
      raw,
    };
  } catch {
    const raw = JSON.stringify(DEFAULT_GLOBAL_SETTINGS, null, 2);
    return {
      path: getSettingsFilePath(),
      raw,
    };
  }
});

ipcMain.handle('write-global-settings-raw', async (_event, payload) => {
  const raw = String(payload?.raw || '').trim();
  if (!raw) {
    throw new Error('settings.json cannot be empty.');
  }

  const parsed = JSON.parse(raw);
  const settings = await writeGlobalSettings(parsed);
  return {
    path: getSettingsFilePath(),
    settings,
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  for (const sessionId of terminalSessions.keys()) {
    disposeTerminalSession(sessionId);
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
