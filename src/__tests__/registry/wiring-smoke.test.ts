import { describe, it, expect } from 'vitest';
import { SUB_MODULE_IDS } from '@/types/modules';
import { buildTaskPrompt, TaskFactory } from '@/lib/cli-task';
import { getWiringAssets } from '@/lib/feature-definitions';
import type { ProjectContext } from '@/lib/prompt-context';

const ueCtx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

/**
 * Wiring is now relevance-driven: a checklist dispatch carries the Wiring
 * Requirements block IFF the module declares editor-authored wiring assets —
 * the generic boilerplate is skipped for modules with nothing concrete to wire.
 */
describe('registry-wide wiring-smoke', () => {
  const withAssets = [...SUB_MODULE_IDS].filter((m) => getWiringAssets(m).length > 0);
  const withoutAssets = [...SUB_MODULE_IDS].filter((m) => getWiringAssets(m).length === 0);

  it('at least one module declares wiring assets (guards the partition)', () => {
    expect(withAssets.length).toBeGreaterThan(0);
  });

  it.each(withAssets)('checklist dispatch for "%s" carries Wiring Requirements', (moduleId) => {
    const task = TaskFactory.checklist(moduleId, 'item-1', 'Implement the feature.', moduleId, 'http://localhost:3000');
    expect(buildTaskPrompt(task, ueCtx)).toContain('## Wiring Requirements');
  });

  it.each(withoutAssets)('checklist dispatch for "%s" skips the empty Wiring block', (moduleId) => {
    const task = TaskFactory.checklist(moduleId, 'item-1', 'Implement the feature.', moduleId, 'http://localhost:3000');
    expect(buildTaskPrompt(task, ueCtx)).not.toContain('## Wiring Requirements');
  });
});
