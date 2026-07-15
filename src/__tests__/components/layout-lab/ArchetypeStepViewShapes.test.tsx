import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ViewPanel } from '@/components/layout-lab/steps/ArchetypeStep';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import type { ViewDescriptor } from '@/lib/catalog/stepSpec';

const t = LAB_THEMES[0];
const view = (v: ViewDescriptor) => v;

describe('ViewPanel — loud shape mismatches', () => {
  afterEach(cleanup);

  it('checklist: genuinely-absent data keeps the honest empty state', () => {
    render(<ViewPanel t={t} view={view({ kind: 'checklist', field: 'items' })} data={{}} />);
    expect(screen.getByText('Nothing yet — run Produce.')).toBeTruthy();
    expect(screen.queryByTestId('view-shape-mismatch')).toBeNull();
  });

  it('checklist: an array renders as the list (no regression)', () => {
    render(<ViewPanel t={t} view={view({ kind: 'checklist', field: 'items' })} data={{ items: ['alpha', 'beta'] }} />);
    expect(screen.getByText(/alpha/)).toBeTruthy();
    expect(screen.getByText(/beta/)).toBeTruthy();
    expect(screen.queryByTestId('view-shape-mismatch')).toBeNull();
  });

  it('checklist: a present-but-wrong-shape (keyed object) is a LOUD mismatch, not the empty lie', () => {
    render(<ViewPanel t={t} view={view({ kind: 'checklist', field: 'items' })} data={{ items: { a: 1, b: 2 } }} />);
    const mm = screen.getByTestId('view-shape-mismatch');
    expect(mm).toBeTruthy();
    expect(mm.textContent).toContain('a list'); // expected
    expect(mm.textContent).toContain('a key·value object'); // actual
    expect(screen.queryByText('Nothing yet — run Produce.')).toBeNull();
  });
});

describe('ViewPanel — real manifest kind', () => {
  afterEach(cleanup);

  it('manifest: a keyed object renders key·value rows (DataTable), not a list', () => {
    render(<ViewPanel t={t} view={view({ kind: 'manifest', field: 'created' })} data={{ created: { rig: 'biped-41', clips: ['run', 'idle'] } }} />);
    expect(screen.getByText('rig')).toBeTruthy();
    expect(screen.getByText('biped-41')).toBeTruthy();
    expect(screen.getByText('clips')).toBeTruthy();
    // nested array flattened for display
    expect(screen.getByText('run · idle')).toBeTruthy();
    expect(screen.queryByTestId('view-shape-mismatch')).toBeNull();
  });

  it('manifest: an array keeps today\'s list rendering', () => {
    render(<ViewPanel t={t} view={view({ kind: 'manifest', field: 'created' })} data={{ created: ['/Game/A', '/Game/B'] }} />);
    expect(screen.getByText(/\/Game\/A/)).toBeTruthy();
    expect(screen.queryByTestId('view-shape-mismatch')).toBeNull();
  });

  it('manifest: an empty keyed object reads as empty (not a zero-row table)', () => {
    render(<ViewPanel t={t} view={view({ kind: 'manifest', field: 'created' })} data={{ created: {} }} />);
    expect(screen.getByText('Nothing yet — run Produce.')).toBeTruthy();
  });

  it('manifest: a bare primitive is a loud mismatch', () => {
    render(<ViewPanel t={t} view={view({ kind: 'manifest', field: 'created' })} data={{ created: 'oops' }} />);
    expect(screen.getByTestId('view-shape-mismatch').textContent).toContain('a string');
  });

  it('manifest: absent data keeps the honest empty state', () => {
    render(<ViewPanel t={t} view={view({ kind: 'manifest', field: 'created' })} data={{}} />);
    expect(screen.getByText('Nothing yet — run Produce.')).toBeTruthy();
  });
});

describe('ViewPanel — other kinds unchanged', () => {
  afterEach(cleanup);

  it('prose renders text and its empty state', () => {
    const { rerender } = render(<ViewPanel t={t} view={view({ kind: 'prose', field: 'brief', emptyText: 'No brief yet' })} data={{ brief: 'A sharp blade.' }} />);
    expect(screen.getByText('A sharp blade.')).toBeTruthy();
    rerender(<ViewPanel t={t} view={view({ kind: 'prose', field: 'brief', emptyText: 'No brief yet' })} data={{}} />);
    expect(screen.getByText('No brief yet')).toBeTruthy();
  });

  it('table renders declared columns', () => {
    render(<ViewPanel t={t} view={view({ kind: 'table', field: 'attrs', columns: [{ key: 'hp' }] })} data={{ attrs: { hp: 42 } }} />);
    expect(screen.getByText('hp')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('gallery falls back to a candidate count', () => {
    render(<ViewPanel t={t} view={view({ kind: 'gallery', field: 'candidates', candidates: 3 })} data={{}} />);
    expect(screen.getByText(/3 candidates/)).toBeTruthy();
  });
});
