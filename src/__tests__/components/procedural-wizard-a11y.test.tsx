import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { ProceduralLevelWizard } from '@/components/modules/content/level-design/ProceduralLevelWizard';
import { SyncDot } from '@/components/modules/content/level-design/LevelDesignView';
import type { SyncStatus } from '@/types/level-design';

afterEach(() => cleanup());

function renderWizard() {
  return render(<ProceduralLevelWizard onGenerate={() => {}} isGenerating={false} />);
}

/* ── Algorithm radiogroup ──────────────────────────────────────────────── */

describe('ProceduralLevelWizard — algorithm radiogroup', () => {
  it('exposes the algorithm grid as a radiogroup of 4 radios', () => {
    renderWizard();
    const group = screen.getByRole('radiogroup', { name: 'Generation algorithm' });
    expect(within(group).getAllByRole('radio').length).toBe(4);
  });

  it('marks the active algorithm with aria-checked and labels each radio with label + description', () => {
    renderWizard();
    const bsp = screen.getByRole('radio', { name: /BSP Tree/ });
    expect(bsp.getAttribute('aria-checked')).toBe('true');
    expect(bsp.getAttribute('aria-label')).toContain('Binary Space Partitioning');

    const wfc = screen.getByRole('radio', { name: /Wave Function Collapse/ });
    expect(wfc.getAttribute('aria-checked')).toBe('false');
  });

  it('uses a roving tabindex so the group is a single tab stop', () => {
    renderWizard();
    expect(screen.getByRole('radio', { name: /BSP Tree/ }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('radio', { name: /Wave Function Collapse/ }).getAttribute('tabindex')).toBe('-1');
  });

  it('moves selection forward with ArrowRight', () => {
    renderWizard();
    const bsp = screen.getByRole('radio', { name: /BSP Tree/ });
    fireEvent.keyDown(bsp, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: /Wave Function Collapse/ }).getAttribute('aria-checked')).toBe('true');
    expect(bsp.getAttribute('aria-checked')).toBe('false');
  });

  it('wraps to the last radio with ArrowLeft from the first', () => {
    renderWizard();
    fireEvent.keyDown(screen.getByRole('radio', { name: /BSP Tree/ }), { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: /Perlin Noise/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('jumps to the last radio with End', () => {
    renderWizard();
    fireEvent.keyDown(screen.getByRole('radio', { name: /BSP Tree/ }), { key: 'End' });
    expect(screen.getByRole('radio', { name: /Perlin Noise/ }).getAttribute('aria-checked')).toBe('true');
  });
});

/* ── Level-type radiogroup ─────────────────────────────────────────────── */

describe('ProceduralLevelWizard — level type radiogroup', () => {
  it('exposes the level type grid as a radiogroup of 3 radios with Dungeon active', () => {
    renderWizard();
    const group = screen.getByRole('radiogroup', { name: 'Level type' });
    expect(within(group).getAllByRole('radio').length).toBe(3);
    expect(within(group).getByRole('radio', { name: /Dungeon/ }).getAttribute('aria-checked')).toBe('true');
  });
});

/* ── Constraint toggles ────────────────────────────────────────────────── */

describe('ProceduralLevelWizard — constraint toggles', () => {
  it('exposes each constraint as an aria-pressed toggle with a descriptive label', () => {
    renderWizard();
    const spawn = screen.getByRole('button', { name: /Spawn Points/ });
    expect(spawn.getAttribute('aria-pressed')).toBe('true');
    expect(spawn.getAttribute('aria-label')).toContain('Player start');
    expect(screen.getByRole('button', { name: /Secret Rooms/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles aria-pressed on click', () => {
    renderWizard();
    const secret = screen.getByRole('button', { name: /Secret Rooms/ });
    fireEvent.click(secret);
    expect(secret.getAttribute('aria-pressed')).toBe('true');
  });
});

/* ── SyncDot — color + glyph, not color alone ──────────────────────────── */

describe('SyncDot', () => {
  const ALL: SyncStatus[] = ['synced', 'doc-ahead', 'code-ahead', 'diverged', 'unlinked'];

  it('renders a glyph (svg) with an accessible label for every status', () => {
    for (const status of ALL) {
      const { container } = render(<SyncDot status={status} />);
      const img = container.querySelector('[role="img"]');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('aria-label')?.startsWith('Sync status:')).toBe(true);
      expect(container.querySelector('svg')).toBeTruthy();
      cleanup();
    }
  });

  it('uses a distinct glyph and label per status (meaning is not color-only)', () => {
    const labels = new Set<string>();
    const glyphs = new Set<string>();
    for (const status of ALL) {
      const { container } = render(<SyncDot status={status} />);
      labels.add(container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '');
      glyphs.add(container.querySelector('svg')?.innerHTML ?? '');
      cleanup();
    }
    expect(labels.size).toBe(ALL.length);
    expect(glyphs.size).toBe(ALL.length);
  });
});
