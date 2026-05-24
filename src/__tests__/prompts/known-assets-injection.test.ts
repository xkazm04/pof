import { describe, it, expect } from 'vitest';
import { buildProjectContextHeader, type ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/proj/PoF',
  ueVersion: '5.7',
};

describe('buildProjectContextHeader known-assets injection', () => {
  it('includes known assets when a character domain is opted in', () => {
    const out = buildProjectContextHeader(ctx, { knownAssetDomains: ['character'] });
    expect(out).toContain('## Known Project Assets');
    expect(out).toContain('/MoverTests/Characters/Mannequins/Meshes/SKM_Manny');
  });

  it('does not include known assets when not opted in', () => {
    const out = buildProjectContextHeader(ctx);
    expect(out).not.toContain('## Known Project Assets');
  });

  it('does not include known assets for an empty domain list', () => {
    const out = buildProjectContextHeader(ctx, { knownAssetDomains: [] });
    expect(out).not.toContain('## Known Project Assets');
  });
});
