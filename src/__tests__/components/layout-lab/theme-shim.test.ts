import { describe, it, expect, vi } from 'vitest';
vi.mock('next/font/google', () => { const f = () => ({ className: 'mock-font', variable: '--mock-var' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { LIGHT, DARK, LAB_THEMES, themeAttr } from '@/components/layout-lab/theme';

describe('LabTheme compat shim', () => {
  it('color fields are var(--lab-*) references (theme-agnostic; theme set via [data-theme])', () => {
    expect(LIGHT.ink).toBe('var(--lab-ink)');
    expect(DARK.ink).toBe('var(--lab-ink)');
    expect(LIGHT.panel).toBe('var(--lab-panel)');
    expect(LIGHT.ok).toBe('var(--lab-ok)');
    expect(LIGHT.onAccent).toBe('var(--lab-on-accent)');
  });
  it('keeps JS-read fields real and per-theme', () => {
    expect(LIGHT.id).toBe('light');
    expect(DARK.id).toBe('dark');
    expect(LIGHT.glass).toBe(false);
    expect(DARK.glass).toBe(true);
    expect(typeof LIGHT.fontMono).toBe('string'); // a className, not a var()
    expect(LIGHT.fontMono).not.toContain('var(');
  });
  it('still exposes both themes', () => {
    expect(LAB_THEMES.map((t) => t.id)).toEqual(['light', 'dark']);
  });
  it('themeAttr maps id to the [data-theme] attribute value', () => {
    expect(themeAttr('light')).toBe('blueprint');
    expect(themeAttr('dark')).toBe('studio');
  });
});
