'use client';

import { useMemo, useState } from 'react';
import { CONDEMNING_PROVENANCE } from '@/lib/catalog/acceptance/judgeBridge';
import { BANDS } from '@/lib/judge/rubrics';
import { useStepJudgeVerdicts } from '../../hooks/useStepJudgeVerdicts';
import { useUxVariant } from './useUxVariant';
import { JudgeVerdictPanel } from './JudgeVerdictPanel';
import { judgeDirection, matchVerdict, parseFindings } from './judgeVerdictRecord';
import type { Acceptance, StepPanel } from '../StepFrame';
import type { FixEffect } from '../ArchetypeStep';
import type { LabTheme } from '../../theme';

/** The `?ux=` slug that opts into this prototype. */
export const JUDGE_VERDICT_UX = 'judge-verdict';

/** The step the [UX] proposal is about: Concept Brief, judge-blocked in 26 catalogs (readiness inventory, 2026-10-07). */
const DESK_STEPS: ReadonlySet<string> = new Set(['Concept Brief']);

export interface JudgeVerdictDesk {
  /** The banner acceptance — the input object itself unless the desk is showing. */
  acceptance: Acceptance;
  /** `[Judge verdict]` while the desk is showing, else empty. */
  panels: StepPanel[];
  /** A direction the operator seeded into the Produce panel, if any. */
  seed?: string;
  /** Remount key for the Produce panel, bumped on every seed. 0 until the first seed. */
  seedKey: number;
}

/**
 * PROTOTYPE wiring for `?ux=judge-verdict` (see `JudgeVerdictPanel`). Off — no `ux` flag, another
 * step, no catalog, or no blocking judge FAIL — it returns the acceptance it was given, no panel
 * and no seed, so `ArchetypeStep` renders exactly as before. The verdict read is the cached
 * per-catalog one `useStepAcceptance` already made, so the desk costs no request.
 *
 * On, it adds the panel and — when the judge alone blocks the step — shortens the banner to the
 * decision (score vs bar) and points the one-click fix at the judge's own fix instead of the
 * archetype's generic corrective act.
 */
export function useJudgeVerdictDesk({ t, catalogId, entityId, step, acceptance, fixEffect, liveEligible }: {
  t: LabTheme;
  catalogId?: string;
  entityId: string;
  step: string;
  acceptance: Acceptance;
  fixEffect: FixEffect;
  liveEligible: boolean;
}): JudgeVerdictDesk {
  const on = useUxVariant(JUDGE_VERDICT_UX) && DESK_STEPS.has(step) && !!catalogId;
  const rows = useStepJudgeVerdicts(on ? catalogId : undefined, entityId, step);
  const [seed, setSeed] = useState<{ text: string; key: number } | null>(null);

  const judge = acceptance.judge;
  const blocking = on && acceptance.status === 'fail' && judge?.verdict === 'fail' && CONDEMNING_PROVENANCE.has(judge.provenance);
  const verdict = blocking && judge ? matchVerdict(rows, judge) : undefined;
  const parsed = useMemo(() => (verdict ? parseFindings(verdict.findings) : undefined), [verdict]);
  // The acceptance chain, reconstructed once per verdict change (never on the stock path):
  // did the step's own checker pass, so that the judge alone decided this red?
  const shapePassed = useMemo(() => {
    if (!verdict) return false;
    const chain = acceptance.explain?.();
    return chain?.decidedBy === 'judge-bridge' && !!chain.layers.find((l) => l.id === 'checker')?.output.startsWith('pass');
  }, [verdict, acceptance]);

  if (!verdict || !parsed) return { acceptance, panels: [], seedKey: seed?.key ?? 0, ...(seed ? { seed: seed.text } : {}) };

  const direction = judgeDirection(step, verdict, parsed);
  const onSeed = () => setSeed((s) => ({ text: direction, key: (s?.key ?? 0) + 1 }));
  return {
    // The banner is rewritten only when the judge ALONE decided the red. When the checker fails
    // too, its own reason and its corrective direction stay exactly as the stock banner says them.
    acceptance: shapePassed ? {
      ...acceptance,
      why: `A judge scored this ${step} ${verdict.score}; it passes at ${BANDS.shippable}. The shape check passes, so this verdict is what blocks it.`,
      suggestion: 'Read the full verdict in the Judge verdict panel below, then send the judge’s own fix as the Produce direction.',
      fixDirection: direction,
    } : acceptance,
    panels: [{
      label: 'Judge verdict',
      node: <JudgeVerdictPanel t={t} verdict={verdict} parsed={parsed} shapePassed={shapePassed}
        fixEffect={fixEffect} liveEligible={liveEligible} seeded={seed?.text === direction} onSeed={onSeed} />,
    }],
    seed: seed?.text,
    seedKey: seed?.key ?? 0,
  };
}
