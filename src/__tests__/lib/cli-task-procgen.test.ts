import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

describe('procgen-dungeon task', () => {
  it('TaskFactory.procgenDungeon builds a typed task', () => {
    const t = TaskFactory.procgenDungeon('level-design', { roomCount: 8, seed: 99 }, 'http://localhost:3000', 'Dungeon (UE)');
    expect(t.type).toBe('procgen-dungeon');
    expect(t.roomCount).toBe(8);
    expect(t.seed).toBe(99);
  });

  it('buildTaskPrompt embeds the params, the run command, and a callback', () => {
    const t = TaskFactory.procgenDungeon('level-design', { roomCount: 8, seed: 99 }, 'http://localhost:3000', 'Dungeon (UE)');
    const p = buildTaskPrompt(t, ctx);
    expect(p).toContain('PROCGEN_ROOMS');
    expect(p).toContain('8');
    expect(p).toContain('PROCGEN_SEED');
    expect(p).toContain('build_procgen_dungeon.py');
    expect(p).toContain('-ExecutePythonScript');
    expect(p).toContain('@@CALLBACK');
    // The callback section embeds the marker + result schema (the URL is
    // registered server-side for resolveCallback, not printed in the prompt).
    expect(p).toContain('roomCount');
    expect(p).toContain('Generate a procedural dungeon');
  });
});
