'use client';

import { useCallback, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { diffPrompts, type DiffRow, type DiffWordSegment } from '@/lib/text-diff';
import { ACCENT_EMERALD_DARK, ACCENT_RED, statusBg } from '@/lib/chart-colors';
import { UI_TIMEOUTS } from '@/lib/constants';

/**
 * Word- and line-level before/after diff for the Prompt Optimizer. Insertions
 * render in emerald with a `+` gutter, deletions in red with a `-` gutter and a
 * line-through, and the specific changed words light up inline via a `simple`
 * LCS word diff (see `@/lib/text-diff`). A toggle flips between a unified column
 * and a side-by-side split.
 *
 * Rendering is plain monospace styled to match `CodeViewer` (same surface +
 * toolbar tokens). We deliberately don't pipe prompts through the Shiki
 * singleton: prompts are natural language (no grammar to highlight) and Shiki's
 * token spans would fight the inline word-diff backgrounds.
 */

const ADD = ACCENT_EMERALD_DARK;
const DEL = ACCENT_RED;

type DiffView = 'unified' | 'split';

interface PromptDiffViewProps {
  /** Original prompt text. */
  before: string;
  /** Optimized prompt text. */
  after: string;
  /** Max-height utility class for the scroll region (default 'max-h-72'). */
  maxHeightClass?: string;
}

/** Inline word spans for a single line; changed runs get a tinted background. */
function Segments({ segments }: { segments: DiffWordSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'eq') {
          return <span key={i} data-diff="eq">{seg.text}</span>;
        }
        const color = seg.type === 'add' ? ADD : DEL;
        return (
          <span
            key={i}
            data-diff={seg.type}
            className={`rounded-sm ${seg.type === 'del' ? 'line-through decoration-1' : ''}`}
            style={{ backgroundColor: statusBg(color, 0.2), color }}
          >
            {seg.text}
          </span>
        );
      })}
    </>
  );
}

function gutterSign(type: DiffRow['type']): string {
  return type === 'add' ? '+' : type === 'del' ? '-' : ' ';
}

function lineColor(type: DiffRow['type']): string | undefined {
  return type === 'add' ? ADD : type === 'del' ? DEL : undefined;
}

const NUM_CLASS = 'select-none w-8 px-1 text-right text-text-muted/50 tabular-nums shrink-0';

/** One line in the unified column: both line numbers, a sign, then the content. */
function UnifiedRow({ row }: { row: DiffRow }) {
  const color = lineColor(row.type);
  return (
    <div
      data-diff-line={row.type}
      className="flex items-start leading-relaxed"
      style={{ backgroundColor: color ? statusBg(color, 0.08) : undefined }}
    >
      <span className={NUM_CLASS}>{row.beforeNo ?? ''}</span>
      <span className={NUM_CLASS}>{row.afterNo ?? ''}</span>
      <span data-gutter-sign className="select-none w-4 text-center shrink-0 font-bold" style={{ color }}>
        {gutterSign(row.type)}
      </span>
      <span className={`flex-1 min-w-0 px-2 whitespace-pre-wrap break-words ${row.type === 'eq' ? 'text-text-muted' : 'text-text'}`}>
        <Segments segments={row.segments} />
      </span>
    </div>
  );
}

/** One side of a split row; an absent row renders a faint placeholder. */
function SplitSide({ row, side }: { row: DiffRow | null; side: 'before' | 'after' }) {
  if (!row) {
    return <div className="flex-1 min-w-0 bg-surface/20" aria-hidden />;
  }
  const color = lineColor(row.type);
  const num = side === 'before' ? row.beforeNo : row.afterNo;
  return (
    <div
      data-diff-line={row.type}
      className="flex-1 min-w-0 flex items-start leading-relaxed"
      style={{ backgroundColor: color ? statusBg(color, 0.08) : undefined }}
    >
      <span className={NUM_CLASS}>{num ?? ''}</span>
      <span data-gutter-sign className="select-none w-4 text-center shrink-0 font-bold" style={{ color }}>
        {gutterSign(row.type)}
      </span>
      <span className={`flex-1 min-w-0 px-2 whitespace-pre-wrap break-words ${row.type === 'eq' ? 'text-text-muted' : 'text-text'}`}>
        <Segments segments={row.segments} />
      </span>
    </div>
  );
}

export function PromptDiffView({ before, after, maxHeightClass = 'max-h-72' }: PromptDiffViewProps) {
  const [view, setView] = useState<DiffView>('unified');
  const [copied, setCopied] = useState(false);

  const diff = useMemo(() => diffPrompts(before, after), [before, after]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(after);
      setCopied(true);
      toast.success('Copied optimized prompt to clipboard');
      setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
    } catch {
      toast.error('Clipboard unavailable in this browser');
    }
  }, [after]);

  const { added, removed } = diff.summary;

  return (
    <div className="relative rounded-lg border border-border overflow-hidden bg-surface-deep">
      {/* Toolbar: title, +/- counts, view toggle, copy */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border bg-surface-deep/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">Diff</span>
          <span
            className="px-1.5 py-0.5 rounded text-2xs font-medium tabular-nums"
            style={{ color: ADD, backgroundColor: statusBg(ADD, 0.12) }}
            aria-label={`${added} insertion${added === 1 ? '' : 's'}`}
          >
            +{added}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-2xs font-medium tabular-nums"
            style={{ color: DEL, backgroundColor: statusBg(DEL, 0.12) }}
            aria-label={`${removed} deletion${removed === 1 ? '' : 's'}`}
          >
            -{removed}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border border-border overflow-hidden" role="group" aria-label="Diff layout">
            {(['unified', 'split'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`px-2 py-0.5 text-2xs font-medium capitalize transition-colors ${
                  view === v ? 'bg-surface-hover text-text' : 'text-text-muted hover:text-text'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy optimized prompt"
            aria-label="Copy optimized prompt"
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-ring"
          >
            {copied ? <Check className="w-3.5 h-3.5" style={{ color: ADD }} aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
          </button>
        </div>
      </div>

      {/* Split column headers */}
      {view === 'split' && (
        <div className="flex border-b border-border text-2xs font-semibold uppercase tracking-wider text-text-muted">
          <div className="flex-1 px-3 py-1" style={{ color: DEL }}>Original</div>
          <div className="w-px bg-border" />
          <div className="flex-1 px-3 py-1" style={{ color: ADD }}>Optimized</div>
        </div>
      )}

      {/* Diff body */}
      <div className={`${maxHeightClass} overflow-auto font-mono text-2xs`}>
        {view === 'unified'
          ? diff.unified.map((row, i) => <UnifiedRow key={i} row={row} />)
          : diff.split.map((row, i) => (
              <div key={i} className="flex">
                <SplitSide row={row.left} side="before" />
                <div className="w-px bg-border shrink-0" />
                <SplitSide row={row.right} side="after" />
              </div>
            ))}
      </div>
    </div>
  );
}
