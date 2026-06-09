import { describe, it, expect, vi } from 'vitest';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { labPanelStyle, LIGHT, DARK } from '@/components/layout-lab/theme';

describe('labPanelStyle', () => {
  it('renders a tokenized bordered surface in both themes', () => {
    for (const t of [LIGHT, DARK]) {
      const s = labPanelStyle(t);
      expect(s.background).toBe(t.panel);
      expect(s.border).toBe(`1px solid ${t.line}`);
    }
  });

  it('adds a backdrop blur only in glass (Studio/dark) mode', () => {
    expect(labPanelStyle(LIGHT).backdropFilter).toBeUndefined();
    expect(labPanelStyle(DARK).backdropFilter).toBe('blur(12px)');
  });

  it('does not default a borderRadius (Blueprint keeps sharp corners)', () => {
    // Callers opt into a radius via `extra` (e.g. `t.glass ? 12 : 0`); the base
    // surface must stay sharp so the full-width header bar is never rounded.
    expect(labPanelStyle(LIGHT).borderRadius).toBeUndefined();
    expect(labPanelStyle(DARK).borderRadius).toBeUndefined();
  });

  it('merges `extra` and lets it override base fields', () => {
    const s = labPanelStyle(DARK, { padding: 18, borderRadius: 12, background: 'red' });
    expect(s.padding).toBe(18);
    expect(s.borderRadius).toBe(12);
    expect(s.background).toBe('red'); // extra wins over the base token
    expect(s.backdropFilter).toBe('blur(12px)'); // glass treatment preserved
  });
});
