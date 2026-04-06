import { DEFAULT_EDITOR_SETTINGS } from './editorSettings';
import { DEFAULT_SHORTCUTS } from './shortcutUtils';

export const DEFAULT_GLOBAL_SETTINGS = {
  shortcuts: DEFAULT_SHORTCUTS,
  editor: DEFAULT_EDITOR_SETTINGS,
  snippets: [],
  defaultWorkspacePath: '',
};

export function normalizeGlobalSettings(settings) {
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
