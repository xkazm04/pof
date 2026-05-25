import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

const entity: StoredCatalogEntity = {
  id: 'brute', catalogId: 'bestiary', name: 'Brute',
  categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned', data: { id: 'brute' },
};

describe('evaluate-track task (ECW Phase 13b)', () => {
  it('TaskFactory.evaluateTrack builds a typed task', () => {
    const t = TaskFactory.evaluateTrack('arpg-enemy-ai', entity, 'art-3d', 'http://localhost:3000', 'Eval Brute · 3D Art');
    expect(t.type).toBe('evaluate-track');
    expect(t.trackId).toBe('art-3d');
    expect(t.entity.id).toBe('brute');
    expect(t.appOrigin).toBe('http://localhost:3000');
  });

  it('buildTaskPrompt names the entity + track and asks for an assessment', () => {
    const t = TaskFactory.evaluateTrack('arpg-enemy-ai', entity, 'art-3d', 'http://localhost:3000', 'Eval');
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toContain('Brute');
    expect(prompt).toContain('3D Art');
    expect(prompt).toMatch(/not-started \/ in-progress \/ done \/ blocked/);
  });

  it('buildTaskPrompt embeds a @@CALLBACK writing back to /api/pipeline', () => {
    const t = TaskFactory.evaluateTrack('arpg-enemy-ai', entity, 'animation', 'http://localhost:3000', 'Eval');
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toMatch(/@@CALLBACK:cb-/);
    // The callback schema asks for the assessed state + a note.
    expect(prompt).toContain('"state"');
    expect(prompt).toContain('"note"');
  });
});
