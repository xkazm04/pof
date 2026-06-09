import { describe, it, expect, beforeEach } from 'vitest';
import { useDeepEvalStore } from '@/stores/deepEvalStore';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { SubModuleId } from '@/types/modules';

function mk(desc: string, moduleId = 'arpg-combat'): EvalFinding {
  return {
    id: `id-${desc}`,
    scanId: 'scan-1',
    moduleId: moduleId as SubModuleId,
    pass: 'structure',
    category: 'General',
    severity: 'medium',
    file: 'a.cpp',
    line: 1,
    description: desc,
    suggestedFix: '',
    effort: 'small',
    timestamp: 0,
  };
}

beforeEach(() => {
  useDeepEvalStore.setState({ lastScan: null });
});

describe('useDeepEvalStore', () => {
  it('starts with no baseline', () => {
    expect(useDeepEvalStore.getState().lastScan).toBeNull();
  });

  it('records a scan as the new baseline', () => {
    useDeepEvalStore.getState().recordScan({
      scanId: 'deep-1',
      timestamp: 1000,
      findings: [mk('issue a')],
    });
    const last = useDeepEvalStore.getState().lastScan;
    expect(last?.scanId).toBe('deep-1');
    expect(last?.findings).toHaveLength(1);
  });

  it('overwrites the baseline with the most recent scan', () => {
    const { recordScan } = useDeepEvalStore.getState();
    recordScan({ scanId: 'deep-1', timestamp: 1, findings: [mk('old')] });
    recordScan({ scanId: 'deep-2', timestamp: 2, findings: [mk('new')] });
    const last = useDeepEvalStore.getState().lastScan;
    expect(last?.scanId).toBe('deep-2');
    expect(last?.findings[0].description).toBe('new');
  });

  it('clears the baseline', () => {
    useDeepEvalStore.getState().recordScan({ scanId: 'deep-1', timestamp: 1, findings: [mk('x')] });
    useDeepEvalStore.getState().clearBaseline();
    expect(useDeepEvalStore.getState().lastScan).toBeNull();
  });
});
