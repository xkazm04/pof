import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { CrashHealthMap } from '@/components/modules/evaluator/CrashHealthMap';
import type { CrashReport, CrashPattern } from '@/types/crash-analyzer';

const r = (id: string, mappedModule: string, severity: CrashReport['severity']): CrashReport =>
  ({ id, mappedModule, severity } as CrashReport);

describe('CrashHealthMap', () => {
  afterEach(cleanup);

  it('renders one node per crash-affected module with the module label', () => {
    const reports = [r('c1', 'arpg-character', 'critical'), r('c2', 'arpg-character', 'high'), r('c3', 'arpg-combat', 'low')];
    render(<CrashHealthMap reports={reports} patterns={[] as CrashPattern[]} />);
    expect(screen.getAllByTestId('health-node')).toHaveLength(2);
    expect(screen.getByText('character')).toBeTruthy();
  });

  it('shows an empty hint when there is no crash data', () => {
    render(<CrashHealthMap reports={[]} patterns={[]} />);
    expect(screen.queryAllByTestId('health-node')).toHaveLength(0);
  });
});
