import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ScaffoldChip } from '@/components/modules/core-engine/unique-tabs/ScaffoldPanel';
import type { SectionScaffoldView } from '@/components/modules/core-engine/unique-tabs/useSectionScaffold';

afterEach(cleanup);

const text = (view: SectionScaffoldView) =>
  render(<ScaffoldChip view={view} running={false} />).container.textContent;

describe('ScaffoldChip carries the run-failure reason for every incomplete state', () => {
  const reason = 'run finished, class not found' as const;

  it('absent shows the reason', () => {
    expect(text({ state: 'absent', present: [], missing: ['UA'], reason })).toContain(reason);
  });

  it('partial shows the reason after the missing class', () => {
    const t = text({ state: 'partial', present: ['FB'], missing: ['UARPGEncounterManager'], reason });
    expect(t).toContain('missing UARPGEncounterManager');
    expect(t).toContain(reason);
  });

  it('partial without a prior run keeps the bare missing text', () => {
    expect(text({ state: 'partial', present: ['FB'], missing: ['UA'] })).toBe('missing UA');
  });
});
