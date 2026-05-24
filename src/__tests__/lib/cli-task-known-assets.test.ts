import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/proj/PoF',
  ueVersion: '5.7',
};

describe('buildTaskPrompt known-assets wiring by module', () => {
  it('injects mannequin paths for a character checklist task', () => {
    const task = TaskFactory.checklist(
      'arpg-character',
      'cc-1',
      'Create the player character.',
      'Player',
      'http://localhost:3000',
    );
    const out = buildTaskPrompt(task, ctx);
    expect(out).toContain('/MoverTests/Characters/Mannequins/Meshes/SKM_Manny');
  });

  it('injects character assets for an enemy quick-action task', () => {
    const task = TaskFactory.quickAction(
      'arpg-enemy-ai',
      'Create a red melee grunt enemy.',
      'Enemy',
    );
    const out = buildTaskPrompt(task, ctx);
    expect(out).toContain('/Game/VerticalSlice/M_EnemyRed');
  });

  it('does not inject mannequin paths for an unrelated module', () => {
    const task = TaskFactory.checklist(
      'arpg-loot',
      'loot-1',
      'Create a loot table.',
      'Loot',
      'http://localhost:3000',
    );
    const out = buildTaskPrompt(task, ctx);
    expect(out).not.toContain('/MoverTests/');
  });
});
