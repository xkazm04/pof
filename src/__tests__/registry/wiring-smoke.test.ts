import { describe, it, expect } from 'vitest';
import { SUB_MODULE_IDS } from '@/types/modules';
import { buildTaskPrompt, TaskFactory } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ueCtx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

describe('registry-wide wiring-smoke', () => {
  it.each([...SUB_MODULE_IDS])('checklist dispatch for "%s" carries Wiring Requirements', (moduleId) => {
    const task = TaskFactory.checklist(moduleId, 'item-1', 'Implement the feature.', moduleId, 'http://localhost:3000');
    const prompt = buildTaskPrompt(task, ueCtx);
    expect(prompt).toContain('## Wiring Requirements');
  });
});
