import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj', ueVersion: '5.7.3' };

describe('TaskFactory.importAudioSet', () => {
  it('builds an audio-import task with the right shape', () => {
    const t = TaskFactory.importAudioSet(
      { setName: 'footstep-stone', eventKey: 'footstep', surface: 'stone',
        assets: [{ filename: 'a.mp3', srcAbsPath: 'C:\\src\\a.mp3' }] },
      'http://x', 'Audio Import',
    );
    expect(t.type).toBe('audio-import');
    expect(t.moduleId).toBe('audio');
  });

  it('buildTaskPrompt instructs ExecutePythonScript + @@CALLBACK + script name', () => {
    const t = TaskFactory.importAudioSet(
      { setName: 'footstep-stone', eventKey: 'footstep', surface: 'stone',
        assets: [{ filename: 'a.mp3', srcAbsPath: 'C:\\src\\a.mp3' }] },
      'http://x', 'Audio Import',
    );
    const out = buildTaskPrompt(t, ctx);
    expect(out).toContain('-ExecutePythonScript');
    expect(out).toContain('import_audio_set.py');
    expect(out).toContain('@@CALLBACK');
    expect(out).toContain('footstep-stone');
    // The callback URL is registered server-side, NOT in the prompt — assert the
    // schema token instead (per procgen-driver-panel findings, [[procgen-driver-panel]]).
    expect(out).toContain('assetsImported');
    expect(out).toContain('AUDIO_SOURCES');
    expect(out).toContain('C:\\src\\a.mp3');
  });
});
