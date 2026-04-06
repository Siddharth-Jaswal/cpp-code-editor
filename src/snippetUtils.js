export function createSnippetId() {
  return `snippet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
