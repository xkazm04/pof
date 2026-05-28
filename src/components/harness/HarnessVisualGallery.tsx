'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Loader2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { ACCENT_RED, STATUS_SUCCESS, STATUS_NEUTRAL, OPACITY_15, withOpacity } from '@/lib/chart-colors';
import type { VisualModuleResult } from '@/lib/harness/visual-gate';

interface IterationView {
  iteration: number;
  capturedAt: string;
  modules: VisualModuleResult[];
}

interface ScreenshotsResponse {
  statePath: string;
  baselineSlugs: string[];
  iterations: IterationView[];
}

function imgUrl(iter: number | 'baseline', slug: string, kind: 'screenshot' | 'diff' = 'screenshot'): string {
  const q = new URLSearchParams({ iter: String(iter), slug, kind });
  return `/api/harness/screenshot?${q.toString()}`;
}

function statusStyle(status: VisualModuleResult['status']): React.CSSProperties {
  const tone = status === 'pass' ? STATUS_SUCCESS : status === 'fail' ? ACCENT_RED : STATUS_NEUTRAL;
  return { color: tone, background: withOpacity(tone, OPACITY_15), borderColor: tone };
}

/**
 * Visual gate gallery — surfaces the per-iteration thumbnails the harness
 * already produces but previously discarded. Operator selects an iteration,
 * sees a thumbnail grid with pass/fail/skipped pills, and can scrub a
 * before/after slider against the recorded baseline.
 */
export function HarnessVisualGallery() {
  const [data, setData] = useState<ScreenshotsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [iter, setIter] = useState<number | null>(null);
  const [active, setActive] = useState<VisualModuleResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    tryApiFetch<ScreenshotsResponse>('/api/harness/screenshots').then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setData(r.data);
        setIter(r.data.iterations[0]?.iteration ?? null);
        setError(null);
      } else { setError(r.error); }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const currentIter = useMemo(
    () => data?.iterations.find((i) => i.iteration === iter) ?? null,
    [data, iter],
  );

  if (loading) {
    return (
      <div role="status" className="flex items-center gap-2 text-xs text-text-muted py-4">
        <Loader2 size={14} className="animate-spin" /> Loading screenshots…
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
  if (!data || data.iterations.length === 0) {
    return (
      <p className="text-xs text-text-muted py-4">
        No visual-gate runs yet — start the harness and check back after the first iteration.
      </p>
    );
  }

  return (
    <section aria-label="Visual Gate Gallery" className="space-y-3">
      <header className="flex items-center gap-2 flex-wrap">
        <ImageIcon size={16} className="text-text-muted" />
        <span className="font-mono uppercase tracking-[0.15em] text-xs text-text">Iteration</span>
        <select
          aria-label="Select iteration"
          value={iter ?? ''}
          onChange={(e) => { setIter(Number(e.target.value)); setActive(null); }}
          className="text-xs font-mono rounded border border-border/60 bg-surface-deep/60 text-text px-2 py-1 focus-ring"
        >
          {data.iterations.map((it) => (
            <option key={it.iteration} value={it.iteration}>
              #{it.iteration}{it.capturedAt ? ` · ${it.capturedAt.slice(0, 16).replace('T', ' ')}` : ''}
            </option>
          ))}
        </select>
        <span className="text-2xs text-text-muted ml-2">{data.baselineSlugs.length} baselines</span>
      </header>

      {currentIter && (
        <div role="list" className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {currentIter.modules.map((m) => (
            <button
              key={m.slug}
              role="listitem"
              onClick={() => setActive(m)}
              data-status={m.status}
              className="text-left rounded-lg border border-border/40 bg-surface-deep/40 overflow-hidden hover:border-border transition-colors focus-ring"
            >
              <div className="relative aspect-video bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl(currentIter.iteration, m.slug)} alt={m.label} className="w-full h-full object-cover object-top" />
                <span
                  className="absolute top-1.5 left-1.5 text-2xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border"
                  style={statusStyle(m.status)}
                >
                  {m.status}
                </span>
                {m.errors.length > 0 && (
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap gap-1">
                    {m.errors.slice(0, 3).map((e) => (
                      <span key={e} className="text-2xs font-mono px-1 py-0.5 rounded" style={{ background: withOpacity(ACCENT_RED, OPACITY_15), color: ACCENT_RED }}>
                        {e.split(':')[0]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-2 py-1.5 flex items-center justify-between text-xs">
                <span className="text-text truncate">{m.label}</span>
                <span className="font-mono text-text-muted">
                  {m.changePct != null ? `${(m.changePct * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {active && currentIter && <BeforeAfter iteration={currentIter.iteration} mod={active} hasBaseline={data.baselineSlugs.includes(active.slug)} />}
    </section>
  );
}

function BeforeAfter({ iteration, mod, hasBaseline }: { iteration: number; mod: VisualModuleResult; hasBaseline: boolean }) {
  const [split, setSplit] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!hasBaseline) {
    return (
      <div className="p-3 rounded-lg border border-border/40 bg-surface-deep/40 text-xs text-text-muted">
        No baseline yet for <span className="font-mono text-text">{mod.label}</span> — this iteration becomes the golden capture.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/40 bg-surface-deep/40 overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between text-xs">
        <span className="font-mono text-text">{mod.label} · baseline ⇄ iter #{iteration}</span>
        <span className="font-mono text-text-muted">
          {mod.changePct != null ? `${(mod.changePct * 100).toFixed(2)}% changed` : 'no diff data'}
        </span>
      </div>
      <div
        ref={containerRef}
        className="relative aspect-video bg-black"
        onMouseMove={(e) => {
          if (!containerRef.current) return;
          const r = containerRef.current.getBoundingClientRect();
          setSplit(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgUrl('baseline', mod.slug)} alt="baseline" className="absolute inset-0 w-full h-full object-cover object-top" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgUrl(iteration, mod.slug)} alt="current" className="absolute inset-0 w-full h-full object-cover object-top" style={{ clipPath: `inset(0 0 0 ${split}%)` }} />
        <div className="absolute top-0 bottom-0 border-l-2 border-white/70 pointer-events-none" style={{ left: `${split}%` }} />
      </div>
      <input
        type="range" min={0} max={100} value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        aria-label="Before/after slider"
        className="w-full"
      />
    </div>
  );
}
