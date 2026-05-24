import { describe, it, expect } from 'vitest';
import { SUB_MODULES } from '@/lib/module-registry';

describe('scene-composer knowledge tips', () => {
  it('documents the Blender MCP socket-vs-headless choice', () => {
    const mod = SUB_MODULES.find((m) => m.id === 'scene-composer');
    expect(mod).toBeDefined();
    const tips = mod!.knowledgeTips ?? [];
    // Folder-05 pof-app §6: the operator guidance must cover both paths —
    // headless (`--background`) as the default for one-shot batch authoring,
    // and the MCP socket for interactive/live editing.
    const hasGuidance = tips.some(
      (t) =>
        /headless/i.test(t.content) &&
        /--background/.test(t.content) &&
        /socket/i.test(t.content) &&
        /interactive/i.test(t.content),
    );
    expect(hasGuidance).toBe(true);
  });
});
