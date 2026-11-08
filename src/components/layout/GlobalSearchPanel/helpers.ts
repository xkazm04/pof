import { HIGHLIGHT_OPEN, HIGHLIGHT_CLOSE } from '@/lib/search-markers';

// ── Highlight FTS5 markers ───────────────────────────────────────────────────

export function highlightMarkers(text: string): string {
  // FTS5 snippet wraps hits in the private-use pair from search-markers
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replaceAll(HIGHLIGHT_OPEN, '<mark class="bg-accent-setup/20 text-accent-setup rounded px-px">')
    .replaceAll(HIGHLIGHT_CLOSE, '</mark>');
}
