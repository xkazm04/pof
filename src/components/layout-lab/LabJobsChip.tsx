'use client';

import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { Button } from './ui/Button';

export function LabJobsChip() {
  const phase = useOneShotJobStore((s) => s.phase);
  const catalogId = useOneShotJobStore((s) => s.catalogId);
  const refinementTurns = useOneShotJobStore((s) => s.refinementTurns);
  const currentStepIndex = useOneShotJobStore((s) => s.currentStepIndex);
  const totalSteps = useOneShotJobStore((s) => s.totalSteps);
  const setPanelOpen = useOneShotLabStore((s) => s.setPanelOpen);

  if (phase === 'idle') return null;

  const label =
    phase === 'analyzing' ? `Jobs · ${catalogId} · scanning…` :
    phase === 'proposing' ? `Jobs · ${catalogId} · drafting…` :
    phase === 'refining'  ? `Jobs · ${catalogId} · refine ${refinementTurns}/3` :
    phase === 'running'   ? `Jobs · ${catalogId} · ${currentStepIndex + 1}/${totalSteps || '?'}` :
    phase === 'completed' ? `Jobs · ${catalogId} · ✓ done` :
    phase === 'failed'    ? `Jobs · ${catalogId} · failed` : '';

  return (
    <Button
      onClick={() => setPanelOpen(true)}
      mono
      ariaLabel="open one-shot panel"
      style={{
        color: 'var(--lab-ink)',
        borderColor: 'var(--lab-line)',
        background: 'transparent',
      }}
    >
      {label}
    </Button>
  );
}
