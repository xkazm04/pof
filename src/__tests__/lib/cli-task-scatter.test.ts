import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

describe('biome-scatter task', () => {
  it('TaskFactory.scatterBiome builds a typed task', () => {
    const t = TaskFactory.scatterBiome('level-design', { density: 1.5, seed: 7 }, 'http://localhost:3000', 'Scatter (UE)');
    expect(t.type).toBe('biome-scatter');
    expect(t.density).toBe(1.5);
    expect(t.seed).toBe(7);
  });

  it('buildTaskPrompt embeds the params, the run command, and a callback', () => {
    const t = TaskFactory.scatterBiome('level-design', { density: 1.5, seed: 7 }, 'http://localhost:3000', 'Scatter (UE)');
    const p = buildTaskPrompt(t, ctx);
    expect(p).toContain('SCATTER_DENSITY');
    expect(p).toContain('1.5');
    expect(p).toContain('SCATTER_SEED');
    expect(p).toContain('scatter_biome_ue.py');
    expect(p).toContain('-ExecutePythonScript');
    expect(p).toContain('@@CALLBACK');
    expect(p).toContain('instanceCount');
    expect(p).toContain('Scatter the arena');
  });
});
