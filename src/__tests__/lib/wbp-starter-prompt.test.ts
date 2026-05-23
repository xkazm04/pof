import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt, type WBPStarterTask } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj',
  ueVersion: '5.7.3',
};

const make = (cls = 'UARPGHUDWidget') =>
  TaskFactory.wbpStarter('arpg-ui', cls, 'http://localhost:3000', `Scaffold WBP_${cls}`);

describe('wbp-starter task', () => {
  it('TaskFactory.wbpStarter builds a wbp-starter task carrying the target class', () => {
    const task: WBPStarterTask = make();
    expect(task.type).toBe('wbp-starter');
    expect(task.targetClass).toBe('UARPGHUDWidget');
    expect(task.appOrigin).toBe('http://localhost:3000');
  });

  it('buildTaskPrompt names the class and instructs header read + BindWidget extraction', () => {
    const out = buildTaskPrompt(make(), ctx);
    expect(out).toContain('UARPGHUDWidget');
    expect(out).toMatch(/BindWidget/);
    expect(out).toMatch(/BindWidgetOptional/);
  });

  it('instructs Python create_asset + reparent via -ExecutePythonScript (not -run=pythonscript)', () => {
    const out = buildTaskPrompt(make(), ctx);
    expect(out).toContain('create_asset');
    expect(out).toContain('WidgetBlueprintFactory');
    expect(out).toContain('-ExecutePythonScript');
    expect(out).toMatch(/-run=pythonscript/); // mentioned as the thing to avoid
    expect(out.toLowerCase()).toMatch(/do not use|avoid|unreliable/);
  });

  it('specifies the README artifact path and a children table', () => {
    const out = buildTaskPrompt(make(), ctx);
    expect(out).toContain('README');
    expect(out).toContain('Source/PoF/UI');
    expect(out).toContain('/Game/UI/');
  });
});
