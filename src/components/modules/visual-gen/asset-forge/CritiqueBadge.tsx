'use client';

import type { Scorecard } from '@/lib/visual-gen/mesh-critique';
import type { StatusLevel } from '@/lib/status-token';
import { StatusTag } from '@/components/ui/StatusTag';
import type { ForgeCritique } from './forgeJobStatus';

/** Verdict → the shared colorblind-safe status ramp (color + glyph + word). */
const VERDICT_LEVEL: Record<Scorecard['verdict'], StatusLevel> = {
  pass: 'ok',
  warn: 'warn',
  fail: 'bad',
};

function fidelityLevel(f: number): StatusLevel {
  return f >= 0.9 ? 'ok' : f >= 0.8 ? 'warn' : 'bad';
}

/** Quality card for a generated mesh: Tier-1 geometry verdict (pass/warn/fail + score)
 * + headline metrics + reasons, plus the optional Tier-2 CLIP fidelity vs the input.
 *
 * A critique that FAILED TO RUN is a first-class case here: the gate is best-effort
 * (it needs the TripoSR venv's trimesh), so `{ ok: false, error }` is a real outcome.
 * It reads as "critique did not run — <reason>", never as a scorecard, and — unlike
 * the old shape, where an errored critique arrived as `{}` and `VERDICT[undefined]`
 * threw into the module error boundary — it cannot crash the module. */
export function CritiqueBadge({ critique, fidelity }: { critique: ForgeCritique; fidelity?: number }) {
  if (!critique.ok) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="quality gate">
        <StatusTag level="warn" word="NO CRITIQUE" iconClassName="w-2.5 h-2.5" />
        <span className="text-2xs text-text-muted" data-testid="critique-not-run">
          critique did not run — {critique.error}
        </span>
      </div>
    );
  }

  const m = critique.metrics;
  return (
    <div className="mt-2" aria-label="quality gate">
      <div className="flex flex-wrap items-center gap-2">
        {/* The verdict hook lives on the wrapper: StatusTag owns its own markup
            (and exposes `data-status`), so callers don't reach inside it. */}
        <span data-testid="critique-verdict" data-verdict={critique.verdict} className="inline-flex">
          <StatusTag
            level={VERDICT_LEVEL[critique.verdict]}
            word={`quality: ${critique.verdict} · ${critique.score}`}
            iconClassName="w-2.5 h-2.5"
            className="normal-case"
          />
        </span>
        {typeof fidelity === 'number' && (
          <span data-testid="critique-fidelity" data-fidelity={fidelity.toFixed(2)} className="inline-flex">
            <StatusTag
              level={fidelityLevel(fidelity)}
              word={`fidelity: ${fidelity.toFixed(2)}`}
              iconClassName="w-2.5 h-2.5"
              className="normal-case"
            />
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
