'use client';

import { useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { StatusTag } from '@/components/ui/StatusTag';
import type { BindIconsSummary } from '@/lib/catalog/acceptance/bindIconsAll';
import type { LabTheme } from './theme';
import { Button } from './ui/Button';

/**
 * Matrix header action: run the icon-bind pass from the lab instead of by hand.
 *
 * `GET|POST /api/pipeline-artifacts/bind-icons` has always been a real route with no UI —
 * operationally a documented curl that fleet-memory says must be re-run after every
 * campaign. It binds library art from `generated/icons/` onto each stub artifact's selected
 * candidate and RE-GRADES through the server checker, so it cannot manufacture a pass.
 *
 * Two clicks, never one: **Preview** is the route's `GET` dry run (writes nothing) and
 * **Bind** is the `POST`. What the pass NEEDS — generated files on disk — is disclosed
 * before either click, because the honest failure mode here is an empty library, and
 * "0 bound" is rendered as a first-class line WITH its top reason rather than a silent
 * no-op or a bare "done". Every row reports which scope of the library served it
 * (`entity` = art generated for that exact entity, `step` = the catalog-wide icon standing
 * in), so a substitution is stated.
 */

/** A skipped/`0 bound` outcome, explained. Pure so the wording is testable without a fetch. */
export interface BindOutcomeLines {
  headline: string;
  /** Skip reasons the route reported, most frequent first. */
  reasons: { reason: string; count: number }[];
  /** How many bound rows came from entity art vs the per-step fallback. */
  scopes: { entity: number; step: number };
  /** Verdict deltas the re-grade produced (`deferred → pass`), most frequent first. */
  moved: { label: string; count: number }[];
  /** Artifacts the library holds no art for at all — counted, never listed as rows. */
  noArt: number;
}

function tally<T>(items: T[], key: (t: T) => string): { k: string; count: number }[] {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m].map(([k, count]) => ({ k, count })).sort((a, b) => b.count - a.count);
}

/** Turn the route's own counters into the lines the panel renders. Pure. */
export function describeBindOutcome(s: BindIconsSummary, applied: boolean): BindOutcomeLines {
  const rows = s.results ?? [];
  const bound = rows.filter((r) => r.scope != null);
  const skips = rows.filter((r) => r.scope == null);
  const noArt = Math.max(0, s.skipped - skips.length);
  const reasons = tally(skips, (r) => r.detail).map(({ k, count }) => ({ reason: k, count }));
  const verb = applied ? 'bound' : 'would bind';
  let headline: string;
  if (s.bound === 0) {
    const why =
      s.library === 0
        ? 'the icon library is empty — generated/icons/ holds no files for any step'
        : noArt > 0 && reasons.length === 0
          ? `the library holds no art matching ${noArt} artifact${noArt > 1 ? 's' : ''}`
          : (reasons[0]?.reason ?? 'nothing matched');
    headline = `0 ${verb} — ${why}.`;
  } else {
    headline = `${s.bound} ${verb} · ${s.changed} verdict${s.changed === 1 ? '' : 's'} ${applied ? 'moved' : 'would move'} · ${s.skipped} skipped · ${s.library} file${s.library === 1 ? '' : 's'} in the library.`;
  }
  return {
    headline,
    reasons,
    scopes: {
      entity: bound.filter((r) => r.scope === 'entity').length,
      step: bound.filter((r) => r.scope === 'step').length,
    },
    moved: tally(bound.filter((r) => r.changed), (r) => `${r.from} → ${r.to}`).map(({ k, count }) => ({ label: k, count })),
    noArt,
  };
}

type Phase = 'idle' | 'previewing' | 'binding';

export function MatrixBindIcons({ t }: { t: LabTheme }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [outcome, setOutcome] = useState<{ lines: BindOutcomeLines; applied: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(applied: boolean) {
    setPhase(applied ? 'binding' : 'previewing');
    setError(null);
    const res = await tryApiFetch<BindIconsSummary>(
      '/api/pipeline-artifacts/bind-icons',
      applied ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' } : undefined,
    );
    setPhase('idle');
    if (!res.ok) { setOutcome(null); setError(res.error); return; }
    setOutcome({ lines: describeBindOutcome(res.data, applied), applied });
  }

  const busy = phase !== 'idle';
  return (
    <div data-testid="bind-icons" className={t.fontMono}
      style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: t.muted }}>
      <Button mono onClick={() => void run(false)} disabled={busy} data-testid="bind-icons-preview"
        ariaLabel="Preview the icon bind — a dry run that writes nothing">
        {phase === 'previewing' ? '⏳ Previewing…' : '👁 Preview icon bind'}
      </Button>
      <Button mono variant="accent" onClick={() => void run(true)} disabled={busy} data-testid="bind-icons-run"
        ariaLabel="Bind generated icons onto stub artifacts and re-grade them on the server">
        {phase === 'binding' ? '⏳ Binding…' : '🖼 Bind icons'}
      </Button>

      {/* What the pass NEEDS, before the click. An empty library is the real failure mode. */}
      <span data-testid="bind-icons-needs" style={{ flexBasis: '100%', fontSize: 12 }}>
        Binds already-generated art from <code>generated/icons/</code> onto each stub gallery
        artifact and re-grades it through the server checker — it needs those files on disk and
        cannot manufacture a pass. Preview is a dry run; Bind writes.
      </span>

      {error && (
        <span data-testid="bind-icons-error" role="status" aria-live="polite"
          style={{ flexBasis: '100%', fontSize: 12, color: t.bad }}>
          Bind request failed — {error}
        </span>
      )}

      {outcome && (
        <div data-testid="bind-icons-summary" role="status" aria-live="polite"
          style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusTag level={outcome.lines.headline.startsWith('0 ') ? 'warn' : 'ok'}
              word={outcome.applied ? 'BOUND' : 'DRY RUN'} />
            <span style={{ color: t.text }}>{outcome.lines.headline}</span>
          </span>
          {(outcome.lines.scopes.entity > 0 || outcome.lines.scopes.step > 0) && (
            <span data-testid="bind-icons-scopes">
              {outcome.lines.scopes.entity} from art made for that entity · {outcome.lines.scopes.step} from
              {' '}the catalog-wide step icon standing in.
            </span>
          )}
          {outcome.lines.moved.map((m) => (
            <span key={m.label} data-testid="bind-icons-moved" style={{ color: t.ok }}>{m.count} × {m.label}</span>
          ))}
          {outcome.lines.reasons.map((r) => (
            <span key={r.reason} data-testid="bind-icons-reason" style={{ color: t.warn }}>{r.count} × skipped: {r.reason}</span>
          ))}
          {outcome.lines.noArt > 0 && (
            <span data-testid="bind-icons-no-art">
              {outcome.lines.noArt} artifact{outcome.lines.noArt > 1 ? 's' : ''} the library holds no matching art for —
              {' '}generate it, or accept the step stays a swatch.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
