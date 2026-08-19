import { describe, it, expect, beforeEach } from 'vitest';
import { useDeepEvalStore, projectIdOf, type StoredScan } from '@/stores/deepEvalStore';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { SubModuleId } from '@/types/modules';

const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const PROJECT_B = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';

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
  localStorage.clear();
});

describe('useDeepEvalStore', () => {
  it('starts with no baseline', () => {
    expect(useDeepEvalStore.getState().lastScan).toBeNull();
  });

  it('records a scan as the new baseline', () => {
    useDeepEvalStore.getState().recordScan({
      scanId: 'deep-1',
      timestamp: 1000,
      projectPath: PROJECT_A,
      findings: [mk('issue a')],
    });
    const last = useDeepEvalStore.getState().lastScan;
    expect(last?.scanId).toBe('deep-1');
    expect(last?.findings).toHaveLength(1);
  });

  it('overwrites the baseline with the most recent scan', () => {
    const { recordScan } = useDeepEvalStore.getState();
    recordScan({ scanId: 'deep-1', timestamp: 1, projectPath: PROJECT_A, findings: [mk('old')] });
    recordScan({ scanId: 'deep-2', timestamp: 2, projectPath: PROJECT_A, findings: [mk('new')] });
    const last = useDeepEvalStore.getState().lastScan;
    expect(last?.scanId).toBe('deep-2');
    expect(last?.findings[0].description).toBe('new');
  });

  it('clears the baseline', () => {
    useDeepEvalStore.getState().recordScan({ scanId: 'deep-1', timestamp: 1, projectPath: PROJECT_A, findings: [mk('x')] });
    useDeepEvalStore.getState().clearBaseline();
    expect(useDeepEvalStore.getState().lastScan).toBeNull();
  });
});

describe('useDeepEvalStore — the baseline is scoped to one project', () => {
  it('serves the baseline to the project it was scanned from', () => {
    useDeepEvalStore.getState().recordScan({ scanId: 'a-1', timestamp: 1, projectPath: PROJECT_A, findings: [mk('x')] });
    expect(useDeepEvalStore.getState().baselineFor(PROJECT_A)?.scanId).toBe('a-1');
  });

  it('refuses to serve one project\'s baseline to another', () => {
    useDeepEvalStore.getState().recordScan({ scanId: 'a-1', timestamp: 1, projectPath: PROJECT_A, findings: [mk('x')] });
    expect(useDeepEvalStore.getState().baselineFor(PROJECT_B)).toBeNull();
    // …while leaving the stored baseline intact for its OWN project.
    expect(useDeepEvalStore.getState().lastScan?.projectPath).toBe(PROJECT_A);
  });

  it('treats "no project open" as its own identity, not as a wildcard', () => {
    useDeepEvalStore.getState().recordScan({ scanId: 'u-1', timestamp: 1, projectPath: '', findings: [mk('x')] });
    expect(useDeepEvalStore.getState().baselineFor('')?.scanId).toBe('u-1');
    expect(useDeepEvalStore.getState().baselineFor(null)?.scanId).toBe('u-1');
    expect(useDeepEvalStore.getState().baselineFor(PROJECT_A)).toBeNull();
  });

  it('discards an unscoped (pre-scoping) cached baseline instead of guessing a project', () => {
    // A cache written before the baseline carried a project identity.
    const legacy = { scanId: 'legacy', timestamp: 1, findings: [mk('x')] } as unknown as StoredScan;
    useDeepEvalStore.setState({ lastScan: legacy });
    expect(useDeepEvalStore.getState().baselineFor(PROJECT_A)).toBeNull();
    expect(useDeepEvalStore.getState().baselineFor('')).toBeNull();
  });

  it('drops an unscoped cached baseline on rehydrate rather than keeping it around', async () => {
    localStorage.setItem(
      'pof-deep-eval',
      JSON.stringify({ state: { lastScan: { scanId: 'legacy', timestamp: 1, findings: [mk('x')] } }, version: 0 }),
    );
    await useDeepEvalStore.persist.rehydrate();
    expect(useDeepEvalStore.getState().lastScan).toBeNull();
  });

  it('keeps a scoped cached baseline across a rehydrate', async () => {
    localStorage.setItem(
      'pof-deep-eval',
      JSON.stringify({
        state: { lastScan: { scanId: 'a-1', timestamp: 1, projectPath: PROJECT_A, findings: [mk('x')] } },
        version: 0,
      }),
    );
    await useDeepEvalStore.persist.rehydrate();
    expect(useDeepEvalStore.getState().baselineFor(PROJECT_A)?.scanId).toBe('a-1');
  });

  it('normalizes an absent project to the server\'s unscoped id', () => {
    expect(projectIdOf(undefined)).toBe('');
    expect(projectIdOf(null)).toBe('');
    expect(projectIdOf(PROJECT_A)).toBe(PROJECT_A);
  });
});
