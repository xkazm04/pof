'use client';

import type { Scorecard, CritiqueCard } from '@/lib/visual-gen/mesh-critique';

const VERDICT: Record<Scorecard['verdict'], { cls: string; glyph: string }> = {
  pass: { cls: 'text-emerald-400 bg-emerald-400/10', glyph: '✓' },
  warn: { cls: 'text-amber-400 bg-amber-400/10', glyph: '⚠' },
  fail: { cls: 'text-red-400 bg-red-400/10', glyph: '✕' },
};

function fidelityCls(f: number): string {
  return f >= 0.9 ? 'text-emerald-400 bg-emerald-400/10' : f >= 0.8 ? 'text-amber-400 bg-amber-400/10' : 'text-red-400 bg-red-400/10';
}

/** Quality card for a generated mesh: Tier-1 geometry verdict (pass/warn/fail + score)
 * + headline metrics + reasons, plus the optional Tier-2 CLIP fidelity vs the input. */
export function CritiqueBadge({ critique, fidelity }: { critique: CritiqueCard; fidelity?: number }) {
  const v = VERDICT[critique.verdict];
  const m = critique.metrics;
  return (
    <div className="mt-2" aria-label="quality gate">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium ${v.cls}`} data-verdict={critique.verdict}>
          {v.glyph} quality: {critique.verdict} · {critique.score}
        </span>
        {typeof fidelity === 'number' && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium ${fidelityCls(fidelity)}`} data-fidelity={fidelity.toFixed(2)}>
            fidelity: {fidelity.toFixed(2)}
          </span>
        )}
        {m && (
          <span className="text-2xs text-text-muted">
            {m.faces.toLocaleString()} tris · {m.components} part{m.components === 1 ? '' : 's'}{m.watertight ? ' · watertight' : ''}
          </span>
        )}
      </div>
      {critique.reasons.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {critique.reasons.map((r, i) => (
            <li key={i} className="text-2xs text-text-muted">· {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
