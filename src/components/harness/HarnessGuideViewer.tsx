'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, AlertTriangle, Copy, Download, ScrollText, Check } from 'lucide-react';
import { toast } from 'sonner';
import { tryApiFetch } from '@/lib/api-utils';
import { MODULE_COLORS, OPACITY_15, withOpacity } from '@/lib/chart-colors';
import { UI_TIMEOUTS } from '@/lib/constants';
import { parseGuideMarkdown, type GuideBlock, type GuidePhaseBlock } from '@/lib/harness/guide-markdown';
import { CodeViewer } from '@/components/ui/CodeViewer';

interface GuideResponse {
  guide: { title: string; totalIterations: number };
  markdown: string;
}

const PHASE_ACCENT = MODULE_COLORS.evaluator;

/**
 * Premium reader for the harness's headline deliverable. Parses the rendered
 * guide markdown into typed blocks, slots {@link CodeViewer} into any fenced
 * code, and surfaces a sticky phase rail + duration chips + copy/download
 * buttons so the playbook reads like the documentation it deserves to be.
 */
export function HarnessGuideViewer() {
  const [data, setData] = useState<GuideResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    tryApiFetch<GuideResponse>('/api/harness?action=guide').then((r) => {
      if (cancelled) return;
      if (r.ok) { setData(r.data); setError(null); }
      else setError(r.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const blocks = useMemo(() => (data ? parseGuideMarkdown(data.markdown) : []), [data]);
  const phases = useMemo(
    () => blocks.filter((b): b is GuidePhaseBlock => b.kind === 'phase'),
    [blocks],
  );

  const copyAll = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.markdown);
      setCopied(true);
      toast.success('Guide copied to clipboard');
      setTimeout(() => setCopied(false), UI_TIMEOUTS.toast);
    } catch { toast.error("Couldn't copy"); }
  };
  const downloadMd = () => {
    if (!data) return;
    const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.guide.title.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div role="status" className="flex items-center gap-2 text-xs text-text-muted py-4">
        <Loader2 size={14} className="animate-spin" /> Loading guide…
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="flex items-center gap-2 text-xs text-amber-400 py-4">
        <AlertTriangle size={14} /> {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div ref={containerRef} className="grid grid-cols-[220px_1fr] gap-6">
      <aside className="sticky top-4 self-start h-fit max-h-[80vh] overflow-y-auto" aria-label="Phases">
        <div className="text-2xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2 flex items-center gap-1.5">
          <ScrollText size={12} /> Phases
        </div>
        <ol className="space-y-1 list-none p-0 m-0">
          {phases.map((p) => (
            <li key={p.phase}>
              <a
                href={`#phase-${p.phase}`}
                className="block text-xs text-text-muted hover:text-text transition-colors py-0.5 border-l-2 border-transparent pl-2 hover:border-current"
              >
                <span className="font-mono mr-1.5 text-2xs">{String(p.phase).padStart(2, '0')}</span>
                {p.label}
              </a>
            </li>
          ))}
        </ol>
        <div className="flex gap-1.5 mt-3">
          <button type="button" onClick={copyAll}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-border/40 text-text-muted hover:text-text hover:border-border focus-ring">
            {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={downloadMd}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-border/40 text-text-muted hover:text-text hover:border-border focus-ring">
            <Download size={12} />.md
          </button>
        </div>
      </aside>

      <article className="max-w-3xl space-y-6 leading-relaxed text-text">
        {blocks.map((b, i) => <BlockView key={i} block={b} />)}
      </article>
    </div>
  );
}

function BlockView({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case 'h1':
      return <h1 className="text-2xl font-semibold text-text leading-tight">{block.text}</h1>;
    case 'h2':
      return <h2 className="text-xl font-semibold text-text mt-8">{block.text}</h2>;
    case 'h3':
      return <h3 className="text-lg font-medium text-text mt-6">{block.text}</h3>;
    case 'phase':
      return (
        <header id={`phase-${block.phase}`} className="mt-10 pb-2 border-b" style={{ borderColor: withOpacity(PHASE_ACCENT, OPACITY_15) }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xs font-mono uppercase tracking-[0.15em]" style={{ color: PHASE_ACCENT }}>
              Phase {String(block.phase).padStart(2, '0')}
            </span>
            {block.duration && (
              <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ background: withOpacity(PHASE_ACCENT, OPACITY_15), color: PHASE_ACCENT }}>
                {block.duration}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold mt-1 text-text">{block.label}</h2>
        </header>
      );
    case 'hr':
      return <hr className="border-border/40" />;
    case 'paragraph':
      return <p className="text-sm" dangerouslySetInnerHTML={{ __html: renderInline(block.text) }} />;
    case 'blockquote':
      return <blockquote className="border-l-2 border-border/40 pl-3 text-sm text-text-muted italic">{block.text}</blockquote>;
    case 'list':
      return (
        <ul className="list-disc list-inside text-sm space-y-1 pl-2">
          {block.items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
          ))}
        </ul>
      );
    case 'code':
      return <CodeViewer code={block.code} fileName={block.fileName ?? `block.${block.lang ?? 'txt'}`} lang={block.lang ?? 'txt'} maxHeightClass="max-h-[480px]" />;
  }
}

/** Inline renderer: `code`, **bold**, links left alone. Output is markup-escaped first. */
function renderInline(s: string): string {
  const escaped = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/`([^`]+)`/g, '<code class="font-mono text-xs px-1 py-0.5 rounded bg-surface-deep/60 text-text">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-text font-semibold">$1</strong>');
}
