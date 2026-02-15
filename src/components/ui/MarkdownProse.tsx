'use client';

import { useMemo } from 'react';

/**
 * Lightweight markdown-to-HTML renderer for Claude output.
 * Handles: headers, bold, italic, inline code, code blocks, bullet lists, numbered lists.
 * No external dependencies — intentionally minimal.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  // Inline code: `code`
  out = out.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
  // Bold: **text** or __text__
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic: *text* or _text_ (but not inside words for _)
  out = out.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');
  out = out.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');
  return out;
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const htmlParts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ```
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // skip closing ```
      htmlParts.push(`<pre class="md-code-block"><code>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // Headers: # ## ###
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      htmlParts.push(`<h${level + 2} class="md-h${level}">${renderInline(headerMatch[2])}</h${level + 2}>`);
      i++;
      continue;
    }

    // Bullet list: - or *
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(renderInline(lines[i].replace(/^\s*[-*]\s+/, '')));
        i++;
      }
      htmlParts.push(`<ul class="md-list">${items.map(item => `<li>${item}</li>`).join('')}</ul>`);
      continue;
    }

    // Numbered list: 1. 2. etc.
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(renderInline(lines[i].replace(/^\s*\d+[.)]\s+/, '')));
        i++;
      }
      htmlParts.push(`<ol class="md-list md-list-ordered">${items.map(item => `<li>${item}</li>`).join('')}</ol>`);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — collect contiguous non-special lines
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      pLines.push(renderInline(lines[i]));
      i++;
    }
    if (pLines.length > 0) {
      htmlParts.push(`<p>${pLines.join(' ')}</p>`);
    }
  }

  return htmlParts.join('');
}

interface MarkdownProseProps {
  content: string;
  className?: string;
}

export function MarkdownProse({ content, className = '' }: MarkdownProseProps) {
  const html = useMemo(() => markdownToHtml(content), [content]);

  return (
    <div
      className={`md-prose ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
