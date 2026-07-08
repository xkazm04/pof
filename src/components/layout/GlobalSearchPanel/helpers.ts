// ── Highlight FTS5 markers ───────────────────────────────────────────────────

export function highlightMarkers(text: string): string {
  // FTS5 snippet uses → and ← as markers
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/→/g, '<mark class="bg-accent-setup/20 text-accent-setup rounded px-px">')
    .replace(/←/g, '</mark>');
}
