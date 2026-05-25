import type { Highlighter } from 'shiki';

/**
 * Shared Shiki highlighter singleton + memoized HTML cache.
 *
 * Both the CLI's `CodeBlockHighlighter` (fenced markdown blocks) and the
 * `CodeViewer` UI component (generated UE5 adapter code) render through this
 * module so the grammars/theme are loaded exactly once for the whole app.
 */

/** Theme used for all in-app code rendering. */
export const SHIKI_THEME = 'vitesse-dark';

const SUPPORTED_LANGS = ['cpp', 'c', 'python', 'json', 'javascript', 'typescript', 'ini', 'yaml', 'bash', 'text'] as const;

const LANG_ALIASES: Record<string, string> = {
  'c++': 'cpp',
  'h': 'cpp',
  'hpp': 'cpp',
  'cc': 'cpp',
  'cxx': 'cpp',
  'py': 'python',
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'sh': 'bash',
  'shell': 'bash',
  'zsh': 'bash',
  'cmd': 'bash',
  'powershell': 'bash',
  'yml': 'yaml',
  'toml': 'ini',
  'cfg': 'ini',
  'txt': 'text',
  'plaintext': 'text',
  'log': 'text',
  '': 'text',
};

let highlighterPromise: Promise<Highlighter> | null = null;

/** Lazily create (once) a shared Shiki highlighter with the supported grammars. */
export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((mod) =>
      mod.createHighlighter({
        themes: [SHIKI_THEME],
        langs: [...SUPPORTED_LANGS],
      }),
    );
  }
  return highlighterPromise;
}

/** Normalize a freeform language hint to a grammar id we actually loaded. */
export function resolveLang(lang: string): string {
  const lower = lang.toLowerCase().trim();
  if (lower in LANG_ALIASES) return LANG_ALIASES[lower];
  return (SUPPORTED_LANGS as readonly string[]).includes(lower) ? lower : 'text';
}

// --- Memoized HTML cache (LRU-ish, bounded) ---

const highlightCache = new Map<string, string>();
const CACHE_LIMIT = 200;

function cacheKey(code: string, resolvedLang: string): string {
  return `${resolvedLang}::${code}`;
}

/**
 * Synchronous cache lookup — returns previously-highlighted HTML, or null if it
 * hasn't been computed yet. Lets components hydrate from cache without a flash.
 */
export function getCachedHighlight(code: string, lang: string): string | null {
  return highlightCache.get(cacheKey(code, resolveLang(lang))) ?? null;
}

/**
 * Highlight `code` to HTML, memoizing the result. Falls back to the plain-text
 * grammar if the requested language fails (e.g. an unloaded grammar).
 */
export async function highlight(code: string, lang: string): Promise<string> {
  const resolved = resolveLang(lang);
  const key = cacheKey(code, resolved);
  const cached = highlightCache.get(key);
  if (cached !== undefined) return cached;

  const hl = await getHighlighter();
  let html: string;
  try {
    html = hl.codeToHtml(code, { lang: resolved, theme: SHIKI_THEME });
  } catch {
    html = hl.codeToHtml(code, { lang: 'text', theme: SHIKI_THEME });
  }

  if (highlightCache.size >= CACHE_LIMIT) {
    const firstKey = highlightCache.keys().next().value;
    if (firstKey !== undefined) highlightCache.delete(firstKey);
  }
  highlightCache.set(key, html);
  return html;
}
