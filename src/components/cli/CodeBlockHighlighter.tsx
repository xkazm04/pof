'use client';

import { useState, useEffect, useMemo } from 'react';
import { getCachedHighlight, highlight } from '@/lib/shiki-highlighter';

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

// --- React component ---

export function HighlightedCodeBlock({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string | null>(() => getCachedHighlight(code, lang));

  useEffect(() => {
    if (html !== null) return;

    let cancelled = false;
    highlight(code, lang).then((result) => {
      if (!cancelled) setHtml(result);
    });

    return () => { cancelled = true; };
  }, [code, lang, html]);

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
