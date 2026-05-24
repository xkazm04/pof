import { describe, it, expect } from 'vitest';
import { getModuleChecklist } from '@/lib/module-registry';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

describe('arpg-character locomotes verification step (folder-02 §6)', () => {
  const items = getModuleChecklist('arpg-character');

  it('has a checklist item flagged with characterCheck', () => {
    const hit = items.find((i) => i.characterCheck === true);
    expect(hit, 'a characterCheck item').toBeTruthy();
    expect(`${hit!.label} ${hit!.description}`.toLowerCase()).toMatch(/locomote|humanoid|pose/);
  });

  it('dispatching that item appends the character-mode Gemini visual check', () => {
    const item = items.find((i) => i.characterCheck === true)!;
    const task = TaskFactory.checklist('arpg-character', item.id, item.prompt, 'Character', 'http://localhost:3000');
    const out = buildTaskPrompt(task, ctx);
    expect(out).toContain('## Character Verification');
    expect(out).toContain('"mode": "character"');
    expect(out.toLowerCase()).toMatch(/humanoid/);
  });
});
