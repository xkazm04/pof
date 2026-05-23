import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

describe('visual-verification section injection (tests.md PoF §3)', () => {
  it('au-1 (visualCheck:true) appends the Visual Verification section', () => {
    const task = TaskFactory.checklist('arpg-ui', 'au-1', 'Build the HUD.', 'HUD', 'http://localhost:3000');
    const out = buildTaskPrompt(task, ctx);
    expect(out).toContain('## Visual Verification');
    expect(out).toContain('http://localhost:3000/api/verify/visual');
  });

  it('au-2 (no visualCheck) does NOT append the section', () => {
    const task = TaskFactory.checklist('arpg-ui', 'au-2', 'Bind the HUD.', 'HUD', 'http://localhost:3000');
    const out = buildTaskPrompt(task, ctx);
    expect(out).not.toContain('## Visual Verification');
  });
});
