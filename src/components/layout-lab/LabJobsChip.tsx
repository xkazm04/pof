'use client';

import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import type { LabTheme } from './theme';

export function LabJobsChip({ t, totalSteps }: { t: LabTheme; totalSteps?: number }) {
  const phase = useOneShotJobStore((s) => s.phase);
  const catalogId = useOneShotJobStore((s) => s.catalogId);
  const refinementTurns = useOneShotJobStore((s) => s.refinementTurns);
  const currentStepIndex = useOneShotJobStore((s) => s.currentStepIndex);
  const setPanelOpen = useOneShotLabStore((s) => s.setPanelOpen);

  if (phase === 'idle') return null;

  const label =
    phase === 'analyzing' ? `Jobs · ${catalogId} · scanning…` :
    phase === 'proposing' ? `Jobs · ${catalogId} · drafting…` :
    phase === 'refining'  ? `Jobs · ${catalogId} · refine ${refinementTurns}/3` :
    phase === 'running'   ? `Jobs · ${catalogId} · ${currentStepIndex + 1}/${totalSteps ?? '?'}` :
    phase === 'completed' ? `Jobs · ${catalogId} · ✓ done` :
    phase === 'failed'    ? `Jobs · ${catalogId} · failed` : '';

  return (
    <button
      onClick={() => setPanelOpen(true)}
      className={t.fontMono}
      aria-label="open one-shot panel"
      style={{
        fontSize: 12,
        padding: '4px 10px',
        border: `1px solid ${t.line}`,
        color: t.ink,
        background: 'transparent',
        cursor: 'pointer',
        borderRadius: t.glass ? 6 : 0,
      }}
    >
      {label}
    </button>
  );
}
