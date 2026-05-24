import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

describe('mixamo-import task', () => {
  it('TaskFactory.mixamoImport builds a typed task', () => {
    const t = TaskFactory.mixamoImport(
      'animations',
      { importDir: 'C:/Users/kazda/Documents/Unreal Projects/PoF/MixamoIncoming', targetSkeleton: '/MoverTests/Characters/Mannequins/Meshes/SK_Mannequin' },
      'http://localhost:3000',
      'Mixamo Import',
    );
    expect(t.type).toBe('mixamo-import');
    expect(t.importDir).toContain('MixamoIncoming');
    expect(t.targetSkeleton).toContain('SK_Mannequin');
  });

  it('buildTaskPrompt embeds the import dir, target skeleton, the script, the editor run, and a callback', () => {
    const t = TaskFactory.mixamoImport(
      'animations',
      { importDir: 'C:/Users/kazda/Documents/Unreal Projects/PoF/MixamoIncoming', targetSkeleton: '/MoverTests/Characters/Mannequins/Meshes/SK_Mannequin' },
      'http://localhost:3000',
      'Mixamo Import',
    );
    const p = buildTaskPrompt(t, ctx);
    expect(p).toContain('MixamoIncoming');
    expect(p).toContain('SK_Mannequin');
    expect(p).toContain('mixamo_pipeline.py');
    expect(p).toContain('-ExecutePythonScript');
    expect(p).toContain('@@CALLBACK');
    expect(p).toContain('importedCount');
    // Surfaces the manual-download contract so the operator gets the FBX right.
    expect(p).toContain('mixamorig');
    expect(/without skin/i.test(p)).toBe(true);
  });
});
