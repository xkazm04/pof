import { describe, it, expect } from 'vitest';
import { buildTaskPrompt, TaskFactory } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ueCtx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

const webCtx: ProjectContext = {
  ...ueCtx,
  dynamicContext: {
    scannedAt: '',
    projectType: 'nextjs',
    classes: [],
    plugins: [],
    buildDependencies: [],
    sourceFileCount: 0,
  },
};

const HEADING = '## Wiring Requirements';

describe('buildTaskPrompt wiring injection', () => {
  it('adds the section to a UE checklist dispatch, with the module assets', () => {
    const task = TaskFactory.checklist('arpg-ui', 'item-1', 'Build the HUD.', 'HUD', 'http://localhost:3000');
    const out = buildTaskPrompt(task, ueCtx);
    expect(out).toContain(HEADING);
    expect(out).toContain('WBP_ARPGHUD'); // arpg-ui's known wiring asset
  });

  it('adds the section to a UE quick-action dispatch', () => {
    const task = TaskFactory.quickAction('arpg-combat', 'Add a dodge.', 'Dodge');
    expect(buildTaskPrompt(task, ueCtx)).toContain(HEADING);
  });

  it('adds the section to a UE feature-fix dispatch', () => {
    const task = TaskFactory.featureFix(
      'arpg-combat',
      { featureName: 'Hit detection', status: 'partial', nextSteps: 'Add notify.', filePaths: [], qualityScore: 3 },
      'Fix',
      'http://localhost:3000',
    );
    expect(buildTaskPrompt(task, ueCtx)).toContain(HEADING);
  });

  it('does NOT add the section to an ask-claude dispatch', () => {
    const task = TaskFactory.askClaude('arpg-combat', 'What does GAS stand for?', 'Ask');
    expect(buildTaskPrompt(task, ueCtx)).not.toContain(HEADING);
  });

  it('does NOT add the section to a feature-review dispatch', () => {
    const task = TaskFactory.featureReview('arpg-combat', 'Combat', [], 'http://localhost:3000', 'Review');
    expect(buildTaskPrompt(task, ueCtx)).not.toContain(HEADING);
  });

  it('does NOT add the section for a non-UE (web) project', () => {
    const task = TaskFactory.checklist('arpg-ui', 'item-1', 'Build the HUD.', 'HUD', 'http://localhost:3000');
    expect(buildTaskPrompt(task, webCtx)).not.toContain(HEADING);
  });
});
