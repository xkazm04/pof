import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import { getModuleChecklist } from '@/lib/module-registry';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

const ld = getModuleChecklist('level-design');
const byId = (id: string) => {
  const item = ld.find((x) => x.id === id);
  if (!item) throw new Error(`No level-design item ${id}`);
  return item;
};

describe('level-design lightingCheck opt-in flags (folder-05 §5)', () => {
  // Items that produce a renderable environment scene → opt into the lit/not-black gate.
  for (const id of ['ld-1', 'ld-5', 'ld-6']) {
    it(`${id} (produces a renderable environment scene) opts into the lighting check`, () => {
      expect(byId(id).lightingCheck).toBe(true);
    });
  }
  // Items that don't produce a new renderable scene → no lighting check.
  for (const id of ['ld-2', 'ld-3', 'ld-4']) {
    it(`${id} (no new renderable scene) does not opt in`, () => {
      expect(byId(id).lightingCheck ?? false).toBe(false);
    });
  }
});

describe('lighting-verification section injection (folder-05 §5)', () => {
  it('ld-1 (lightingCheck:true) appends the Lighting Verification section in lighting mode', () => {
    const task = TaskFactory.checklist('level-design', 'ld-1', 'Build the blockout.', 'Level', 'http://localhost:3000');
    const out = buildTaskPrompt(task, ctx);
    expect(out).toContain('## Lighting Verification');
    expect(out).toContain('"mode": "lighting"');
    expect(out).toContain('http://localhost:3000/api/verify/visual');
  });

  it('ld-2 (no lightingCheck) does NOT append the Lighting Verification section', () => {
    const task = TaskFactory.checklist('level-design', 'ld-2', 'Place spawns.', 'Level', 'http://localhost:3000');
    const out = buildTaskPrompt(task, ctx);
    expect(out).not.toContain('## Lighting Verification');
  });
});
