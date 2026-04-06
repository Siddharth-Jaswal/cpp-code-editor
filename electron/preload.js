const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  runCode: (code) => ipcRenderer.send('run-code', code),
  listTerminals: () => ipcRenderer.invoke('list-terminals'),
  getWorkspace: () => ipcRenderer.invoke('get-workspace'),
  getGlobalSettings: () => ipcRenderer.invoke('get-global-settings'),
  saveGlobalSettings: (payload) => ipcRenderer.invoke('save-global-settings', payload),
  readGlobalSettingsRaw: () => ipcRenderer.invoke('read-global-settings-raw'),
  writeGlobalSettingsRaw: (payload) => ipcRenderer.invoke('write-global-settings-raw', payload),
  chooseWorkspaceDirectory: () => ipcRenderer.invoke('choose-workspace-directory'),
  openWorkspaceDirectory: (payload) => ipcRenderer.invoke('open-workspace-directory', payload),
  readWorkspaceFile: (payload) => ipcRenderer.invoke('read-workspace-file', payload),
  writeWorkspaceFile: (payload) => ipcRenderer.invoke('write-workspace-file', payload),
  createWorkspaceEntry: (payload) => ipcRenderer.invoke('create-workspace-entry', payload),
  renameWorkspaceEntry: (payload) => ipcRenderer.invoke('rename-workspace-entry', payload),
  deleteWorkspaceEntry: (payload) => ipcRenderer.invoke('delete-workspace-entry', payload),
  openTerminal: (payload) => ipcRenderer.send('open-terminal', payload),
  sendTerminalInput: (payload) => ipcRenderer.send('terminal-input', payload),
  resizeTerminal: (payload) => ipcRenderer.send('resize-terminal', payload),
  closeTerminal: (payload) => ipcRenderer.send('close-terminal', payload),
  onCodeOutput: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('code-output', listener);

    return () => {
      ipcRenderer.removeListener('code-output', listener);
    };
  },
  onTerminalEvent: (callback) => {
    const eventNames = ['terminal-opened', 'terminal-data', 'terminal-exit', 'terminal-error'];
    const listeners = eventNames.map((eventName) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on(eventName, listener);
      return { eventName, listener };
    });

    return () => {
      for (const { eventName, listener } of listeners) {
        ipcRenderer.removeListener(eventName, listener);
      }
    };
  },
});
