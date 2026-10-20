import type { SearchResult } from '@/lib/search-index';

// ── Palette recents ──────────────────────────────────────────────────────────
// The last places the user opened from the palette, per project. Storage is a
// per-viewer convenience: every access is guarded so a blocked or full
// localStorage degrades to "no recents", never an exception.

export const RECENTS_CAP = 8;

export function recentsKey(projectPath: string | null): string {
  return `pof:palette-recents:${projectPath ?? ''}`;
}

function isRecent(value: unknown): value is SearchResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.type === 'string'
    && typeof v.moduleId === 'string' && typeof v.title === 'string';
}

export function readRecents(projectPath: string | null): SearchResult[] {
  try {
    const raw = localStorage.getItem(recentsKey(projectPath));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, RECENTS_CAP) : [];
  } catch {
    return [];
  }
}

/** Move `result` to the front (deduped by id), keep the newest RECENTS_CAP. */
export function recordRecent(projectPath: string | null, result: SearchResult): SearchResult[] {
  const slim: SearchResult = {
    id: result.id,
    type: result.type,
    moduleId: result.moduleId,
    moduleLabel: result.moduleLabel,
    // FTS5 highlight markers are only meaningful in the live hit.
    title: result.title.replace(/[→←]/g, ''),
    snippet: '',
    rank: 0,
  };
  const next = [slim, ...readRecents(projectPath).filter((r) => r.id !== slim.id)].slice(0, RECENTS_CAP);
  try {
    localStorage.setItem(recentsKey(projectPath), JSON.stringify(next));
  } catch { /* storage unavailable: recents are a convenience */ }
  return next;
}
