import { describe, it, expect } from 'vitest';
import { buildScreenPrompt } from '@/lib/ui/screen-prompt';

describe('buildScreenPrompt', () => {
  it('names the screen and the trimmed instruction', () => {
    const p = buildScreenPrompt('Main Menu', '  add a settings sub-screen  ');
    expect(p).toContain('Main Menu');
    expect(p).toContain('add a settings sub-screen');
    expect(p).not.toContain('  add a settings');
  });

  it('instructs reuse of UMG + the UI flow rather than inventing a system', () => {
    const p = buildScreenPrompt('X', 'branching dialogue');
    expect(p).toMatch(/UMG|UserWidget/i);
    expect(p).toMatch(/flow/i);
  });

  it('works with an empty instruction', () => {
    expect(buildScreenPrompt('Y', '').length).toBeGreaterThan(0);
  });
});
