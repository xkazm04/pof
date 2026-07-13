import { describe, it, expect } from 'vitest';
import { formatKnowledgeTips } from '@/lib/knowledge/knowledge-tips';
import { buildProjectContextHeader, type ProjectContext } from '@/lib/prompt-context';
import { SUB_MODULE_MAP } from '@/lib/module-registry';

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.7.2' };

// arpg-ui ships a best-practice tip about AddOnScreenDebugMessage — a stable anchor.
const UI_BEST_PRACTICE = 'AddOnScreenDebugMessage overlays the whole viewport';

describe('formatKnowledgeTips (Direction: recover-knowledge-tips)', () => {
  it('returns a scoped tip block containing the module best-practice tip', () => {
    const block = formatKnowledgeTips('arpg-ui', 'ue-cpp');
    expect(block).toContain('## Project Knowledge Tips');
    expect(block).toContain(UI_BEST_PRACTICE);
  });

  it('orders best-practice tips before feasibility tips', () => {
    const block = formatKnowledgeTips('arpg-ui', 'ue-cpp');
    const feasibility = SUB_MODULE_MAP['arpg-ui']!.knowledgeTips.find((t) => t.source === 'feasibility')!;
    expect(block.indexOf(UI_BEST_PRACTICE)).toBeLessThan(block.indexOf(feasibility.title));
  });

  it('returns an empty block for a web prompt kind', () => {
    expect(formatKnowledgeTips('arpg-ui', 'web')).toBe('');
  });

  it('returns an empty block for an absent/unknown module (no crash)', () => {
    expect(formatKnowledgeTips(undefined, 'ue-cpp')).toBe('');
    expect(formatKnowledgeTips('does-not-exist', 'ue-cpp')).toBe('');
    // a module with no authored tips → empty block.
    expect(formatKnowledgeTips('arpg-progression', 'ue-cpp')).toBe('');
  });

  it('is injected into a task prompt via buildProjectContextHeader when the module is in context', () => {
    const header = buildProjectContextHeader(CTX, { module: 'arpg-ui', promptKind: 'ue-cpp' });
    expect(header).toContain('## Project Knowledge Tips');
    expect(header).toContain(UI_BEST_PRACTICE);
  });

  it('injects nothing when no module is in context', () => {
    const header = buildProjectContextHeader(CTX, {});
    expect(header).not.toContain('## Project Knowledge Tips');
  });
});
