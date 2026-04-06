export const DEFAULT_SHORTCUTS = {
  run: 'Ctrl+N',
  save: 'Ctrl+S',
  saveSnippet: 'Ctrl+Alt+S',
  insertSnippet: 'Ctrl+Alt+I',
  zoomIn: 'Ctrl+=',
  zoomOut: 'Ctrl+-',
};

function normalizeKey(key) {
  if (!key) {
    return '';
  }

  if (key === ' ') {
    return 'Space';
  }

  if (key === 'ArrowUp' || key === 'Up') {
    return 'Up';
  }

  if (key === 'ArrowDown' || key === 'Down') {
    return 'Down';
  }

  if (key === 'ArrowLeft' || key === 'Left') {
    return 'Left';
  }

  if (key === 'ArrowRight' || key === 'Right') {
    return 'Right';
  }

  if (key === '+') {
    return '=';
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  return key[0].toUpperCase() + key.slice(1);
}

export function getShortcutFromEvent(event) {
  const modifiers = [];
  const normalizedKey = normalizeKey(event.key);

  if (!normalizedKey || ['Control', 'Shift', 'Alt', 'Meta'].includes(normalizedKey)) {
    return '';
  }

  if (event.ctrlKey || event.metaKey) {
    modifiers.push('Ctrl');
  }

  if (event.altKey) {
    modifiers.push('Alt');
  }

  if (event.shiftKey && normalizedKey !== '=') {
    modifiers.push('Shift');
  }

  return [...modifiers, normalizedKey].join('+');
}

export function formatShortcutLabel(shortcut) {
  if (!shortcut) {
    return 'Unassigned';
  }

  return shortcut.replaceAll('Ctrl', navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl');
}
