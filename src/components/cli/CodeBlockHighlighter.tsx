'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Highlighter } from 'shiki';

// --- Fenced code block parser ---

interface ContentSegment {
  kind: 'text' | 'code';
  value: string;
  lang?: string;
}

const FENCE_RE = /^```(\w*)\s*\n([\s\S]*?)^```\s*$/gm;

/**
 * Split a message string into alternating text and fenced-code segments.
 * Returns null if no code blocks are found (caller can skip rendering).
 */
export function parseCodeBlocks(content: string): ContentSegment[] | null {
  FENCE_RE.lastIndex = 0;
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = FENCE_RE.exec(content)) !== null) {
    // Text before the fence
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) segments.push({ kind: 'text', value: text });
    }
    segments.push({
      kind: 'code',
      value: match[2],
      lang: match[1] || 'text',
    });
    lastIndex = match.index + match[0].length;
  }

  if (segments.length === 0) return null;

  // Trailing text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) segments.push({ kind: 'text', value: text });
  }

  return segments;
}

// --- Shiki singleton (lazy) ---

const SUPPORTED_LANGS = ['cpp', 'c', 'python', 'json', 'javascript', 'typescript', 'ini', 'yaml', 'bash', 'text'] as const;

const LANG_ALIASES: Record<string, string> = {
  'c++': 'cpp',
  'h': 'cpp',
  'hpp': 'cpp',
  'py': 'python',
  'js': 'javascript',
  'ts': 'typescript',
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

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((mod) =>
      mod.createHighlighter({
        themes: ['vitesse-dark'],
        langs: [...SUPPORTED_LANGS],
      })
    );
  }
  return highlighterPromise;
}

function resolveLang(lang: string): string {
  const lower = lang.toLowerCase();
  return LANG_ALIASES[lower] ?? (SUPPORTED_LANGS as readonly string[]).includes(lower) ? lower : 'text';
}

// --- Highlight cache ---

const highlightCache = new Map<string, string>();
const CACHE_LIMIT = 200;

function getCacheKey(code: string, lang: string): string {
  return `${lang}::${code}`;
}

// --- React component ---

export function HighlightedCodeBlock({ code, lang }: { code: string; lang: string }) {
  const resolved = resolveLang(lang);
  const cacheKey = getCacheKey(code, resolved);
  const [html, setHtml] = useState<string | null>(() => highlightCache.get(cacheKey) ?? null);

  useEffect(() => {
    if (html !== null) return;

    let cancelled = false;
    getHighlighter().then((hl) => {
      if (cancelled) return;
      const result = hl.codeToHtml(code, {
        lang: resolved,
        theme: 'vitesse-dark',
      });
      if (highlightCache.size >= CACHE_LIMIT) {
        // Evict oldest entry
        const firstKey = highlightCache.keys().next().value;
        if (firstKey !== undefined) highlightCache.delete(firstKey);
      }
      highlightCache.set(cacheKey, result);
      setHtml(result);
    });

    return () => { cancelled = true; };
  }, [code, resolved, cacheKey, html]);

  if (html === null) {
    // Fallback: monospace pre while shiki loads
    return (
      <pre className="text-2xs font-mono leading-relaxed bg-surface-deep/80 border border-border rounded px-2.5 py-2 overflow-x-auto whitespace-pre text-text-muted my-1">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="terminal-code-block text-2xs leading-relaxed rounded border border-border overflow-x-auto my-1 [&_pre]:!bg-surface-deep/80 [&_pre]:px-2.5 [&_pre]:py-2 [&_pre]:m-0 [&_code]:text-2xs"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// --- Render a full message with mixed text + highlighted code blocks ---

export function AssistantMessageContent({ content }: { content: string }) {
  const segments = useMemo(() => parseCodeBlocks(content), [content]);

  if (!segments) {
    // No code blocks — return null so caller can use default rendering
    return null;
  }

  return (
    <div className="space-y-1 min-w-0">
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          <span key={i} className="text-xs leading-relaxed break-all text-text block">
            {seg.value.length > 300 ? seg.value.slice(0, 300) + '...' : seg.value}
          </span>
        ) : (
          <HighlightedCodeBlock key={i} code={seg.value} lang={seg.lang ?? 'text'} />
        )
      )}
    </div>
  );
}
