import { describe, it, expect } from 'vitest';
import { getEnginePath, getRequiredMSVCVersion } from '@/lib/prompt-context';
import { buildVisualCheckSection } from '@/lib/prompts/visual-check';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

describe('getRequiredMSVCVersion', () => {
  it('maps 5.7+ to 14.44', () => {
    expect(getRequiredMSVCVersion('5.7')).toBe('14.44');
    expect(getRequiredMSVCVersion('5.7.2')).toBe('14.44');
    expect(getRequiredMSVCVersion('5.8')).toBe('14.44');
  });

  it('maps 5.4–5.6 to 14.38 and 5.0–5.3 to 14.34', () => {
    expect(getRequiredMSVCVersion('5.5.1')).toBe('14.38');
    expect(getRequiredMSVCVersion('5.4')).toBe('14.38');
    expect(getRequiredMSVCVersion('5.3')).toBe('14.34');
    expect(getRequiredMSVCVersion('5.0')).toBe('14.34');
  });

  it('throws — never silently defaults — on an unmapped major (the 6.0 bug)', () => {
    expect(() => getRequiredMSVCVersion('6.0')).toThrow(/unsupported UE major/);
    expect(() => getRequiredMSVCVersion('4.27')).toThrow(/unsupported UE major/);
  });

  it('throws on an unparseable version', () => {
    expect(() => getRequiredMSVCVersion('abc')).toThrow(/unparseable/);
    // Empty string coerces to major 0 — still fails loudly, never defaults.
    expect(() => getRequiredMSVCVersion('')).toThrow();
  });
});

describe('engine-path contradiction is impossible (derived from ctx)', () => {
  it('buildVisualCheckSection derives the editor from ueVersion, not a hardcoded 5.7', () => {
    const out = buildVisualCheckSection({
      projectPath: 'C:\\proj\\PoF',
      appOrigin: 'http://localhost:3000',
      moduleId: 'arpg-character',
      itemId: 'x',
      ueVersion: '5.5',
    });
    expect(out).toContain(getEnginePath('5.5'));
    expect(out).not.toContain('UE_5.7');
  });

  it('an explicit editorExe still wins over the derived path', () => {
    const out = buildVisualCheckSection({
      projectPath: 'C:\\proj\\PoF',
      appOrigin: 'http://localhost:3000',
      moduleId: 'arpg-character',
      itemId: 'x',
      ueVersion: '5.5',
      editorExe: 'D:\\custom\\UnrealEditor.exe',
    });
    expect(out).toContain('D:\\custom\\UnrealEditor.exe');
  });

  it('the audio-import prompt names the same engine as the header', () => {
    const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.5.4' };
    const task = TaskFactory.importAudioSet(
      { setName: 'footstep-stone', assets: [{ filename: 's.wav', srcAbsPath: 'C:\\s.wav' }] },
      'http://localhost:3000',
    );
    const prompt = buildTaskPrompt(task, ctx);
    // Header derives `Engine: <getEnginePath>`; the run command must agree.
    expect(prompt).toContain(getEnginePath('5.5.4'));
    expect(prompt).not.toContain('UE_5.7');
  });
});
