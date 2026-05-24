import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

const params = {
  source: 'mannequin' as const,
  playerMesh: '/MoverTests/Characters/Mannequins/Meshes/SKM_Manny',
  enemyMesh: '/MoverTests/Characters/Mannequins/Meshes/SKM_Manny_Simple',
  animBlueprint: '/MoverTests/Characters/Mannequins/Animations/ABP_Manny',
  enemyMaterial: '/Game/VerticalSlice/M_EnemyRed',
};

describe('character-setup task', () => {
  it('TaskFactory.characterSetup builds a typed task', () => {
    const t = TaskFactory.characterSetup('arpg-character', params, 'http://localhost:3000', 'Wire Character');
    expect(t.type).toBe('character-setup');
    expect(t.source).toBe('mannequin');
    expect(t.playerMesh).toContain('SKM_Manny');
    expect(t.enemyMaterial).toContain('M_EnemyRed');
  });

  it('buildTaskPrompt runs setup_characters_ue.py via the full editor with the chosen mesh/skeleton/AnimBP', () => {
    const t = TaskFactory.characterSetup('arpg-character', params, 'http://localhost:3000', 'Wire Character');
    const p = buildTaskPrompt(t, ctx);
    expect(p).toContain('setup_characters_ue.py');
    expect(p).toContain('-ExecutePythonScript');
    expect(p).toContain('SKM_Manny');
    expect(p).toContain('SKM_Manny_Simple');
    expect(p).toContain('ABP_Manny');
    expect(p).toContain('M_EnemyRed');
    expect(p).toContain('mannequin');
  });

  it('reminds about the MoverTests plugin rescan for the mannequin source', () => {
    const t = TaskFactory.characterSetup('arpg-character', params, 'http://localhost:3000', 'Wire Character');
    const p = buildTaskPrompt(t, ctx);
    expect(/rescan|asset registry/i.test(p)).toBe(true);
  });
});
