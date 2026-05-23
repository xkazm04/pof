import { describe, it, expect } from 'vitest';
import { buildProjectContextHeader, type ProjectContext } from '@/lib/prompt-context';

const ueCtx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

const webCtx: ProjectContext = {
  projectName: 'WebApp',
  projectPath: 'C:\\web',
  ueVersion: '5.7.3',
  dynamicContext: {
    scannedAt: '',
    projectType: 'nextjs',
    classes: [],
    plugins: [],
    buildDependencies: [],
    sourceFileCount: 0,
  },
};

describe('context header gotcha + tripwire injection', () => {
  it('injects pitfalls and the tripwire for ue-cpp (the default)', () => {
    const h = buildProjectContextHeader(ueCtx);
    expect(h).toContain('## Known UE Pitfalls');
    expect(h).toContain('Widget Blueprint');
  });

  it('respects an explicit promptKind of ue-python', () => {
    const h = buildProjectContextHeader(ueCtx, { promptKind: 'ue-python' });
    expect(h).toContain('Constant3Vector');
  });

  it('omits both for a web project', () => {
    const h = buildProjectContextHeader(webCtx);
    expect(h).not.toContain('Known UE Pitfalls');
    expect(h).not.toContain('Widget Blueprint');
  });

  it('omits both when promptKind is web on a UE project', () => {
    const h = buildProjectContextHeader(ueCtx, { promptKind: 'web' });
    expect(h).not.toContain('Known UE Pitfalls');
  });
});
