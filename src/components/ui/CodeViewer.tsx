'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getCachedHighlight, highlight } from '@/lib/shiki-highlighter';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { UI_TIMEOUTS } from '@/lib/constants';

interface CodeViewerProps {
  /** Source code to render. */
  code: string;
  /** Filename used for the download action (e.g. "UPoFSwordAdapter.h"). */
  fileName: string;
  /** Shiki language hint (default: 'cpp'). */
  lang?: string;
  /** Badge label shown in the top-right (default: derived from the extension). */
  languageLabel?: string;
  /** Max-height utility class for the scroll region (default: 'max-h-96'). */
  maxHeightClass?: string;
}

/** Build + click a transient anchor to save `text` as a file (client-only). */
function triggerDownload(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function defaultLabel(fileName: string): string {
  if (fileName.endsWith('.cpp')) return 'C++';
  if (fileName.endsWith('.h') || fileName.endsWith('.hpp')) return 'C++ Header';
  return 'Code';
}

/**
 * Syntax-highlighted, read-only code viewer with a sticky toolbar (copy +
 * download), a line-number gutter, a language badge, and a bottom scroll
 * fade-out. Highlighting is done via the shared Shiki singleton in
 * `@/lib/shiki-highlighter`; a plain `<pre>` is shown until it resolves.
 */
export function CodeViewer({
  code,
  fileName,
  lang = 'cpp',
  languageLabel,
  maxHeightClass = 'max-h-96',
}: CodeViewerProps) {
  // Trim trailing whitespace so Shiki doesn't emit a numbered empty last line.
  const trimmed = useMemo(() => code.replace(/\s+$/, ''), [code]);
  const [html, setHtml] = useState<string | null>(() => getCachedHighlight(trimmed, lang));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (html !== null) return;

    let cancelled = false;
    highlight(trimmed, lang).then((result) => {
      if (!cancelled) setHtml(result);
    });

    return () => { cancelled = true; };
  }, [trimmed, lang, html]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      toast.success(`Copied ${fileName} to clipboard`);
      setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
    } catch {
      toast.error('Clipboard unavailable in this browser');
    }
  }, [trimmed, fileName]);

  const handleDownload = useCallback(() => {
    triggerDownload(fileName, `${trimmed}\n`);
    toast.success(`Downloaded ${fileName}`);
  }, [trimmed, fileName]);

  const badge = languageLabel ?? defaultLabel(fileName);

  return (
    <div className="relative bg-surface-deep">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-1.5 bg-surface-deep/95 backdrop-blur-sm border-b border-border">
        <span className="font-mono text-2xs text-text-muted truncate">{fileName}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy code'}
            aria-label={copied ? 'Copied to clipboard' : 'Copy code'}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-bright"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} aria-hidden />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            title={`Download ${fileName}`}
            aria-label={`Download ${fileName}`}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-bright"
          >
            <Download className="w-3.5 h-3.5" aria-hidden />
          </button>
          {/* Language badge — top-right corner */}
          <span className="ml-1 px-1.5 py-0.5 rounded bg-cyan-400/10 border border-cyan-400/20 text-2xs font-medium text-cyan-400 select-none">
            {badge}
          </span>
        </div>
      </div>

      {/* Code body */}
      <div className={`${maxHeightClass} overflow-auto`}>
        {html === null ? (
          <pre className="px-4 py-3 text-2xs font-mono text-text-muted whitespace-pre">{trimmed}</pre>
        ) : (
          <div className="code-viewer-shiki text-2xs" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>

      {/* Subtle scroll fade-out (token-driven gradient — see chart-colors note). */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-8"
        style={{ background: 'linear-gradient(to top, var(--surface-deep), transparent)' }}
        aria-hidden
      />
    </div>
  );
}
