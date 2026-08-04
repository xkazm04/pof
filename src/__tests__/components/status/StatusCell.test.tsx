import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StatusCell } from '@/components/status/StatusCell';
import type { StepCell, CellGrade } from '@/lib/status/statusModel';

// This suite has no auto-cleanup (see src/__tests__/setup.ts).
afterEach(cleanup);

function cell(grade: CellGrade, extra: Partial<StepCell> = {}): StepCell {
  return {
    label: 'Economy',
    engine: 'Claude',
    grade,
    counts: { pass: 0, deferred: 0, fail: 0, pending: 0 },
    ...extra,
  };
}

/** The cell root carries the readiness data attributes. */
function root(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-readiness]') as HTMLElement;
}

describe('StatusCell — one colour language', () => {
  it('renders the readiness rung as text, not hue alone', () => {
    const { container } = render(<StatusCell cell={cell('trusted')} />);
    expect(container.querySelector('[data-testid="readiness-code"]')?.textContent).toBe('R3');
  });

  it('no longer renders the old acceptance-tier code', () => {
    const { container } = render(<StatusCell cell={cell('trusted', { tier: 'L2' })} />);
    expect(container.querySelector('[data-testid="tier-code"]')).toBeNull();
  });

  it('paints NO left tier stripe — the second colour language is gone', () => {
    // The defect: a 3px left border in the tier's hue fought the fill. A cell declaring
    // L4 must not carry any edge colour distinct from its own border.
    const { container } = render(<StatusCell cell={cell('deferred', { tier: 'L4' })} />);
    const style = root(container).style;
    // borderLeft is never set independently any more; only the shorthand `border` is.
    expect(style.borderLeftWidth === '' || style.borderLeftWidth === style.borderTopWidth).toBe(true);
    expect(style.borderLeftColor === '' || style.borderLeftColor === style.borderTopColor).toBe(true);
  });

  it('exposes the rung and state as data attributes for the map filters', () => {
    const { container } = render(<StatusCell cell={cell('verified')} />);
    const el = root(container);
    expect(el.getAttribute('data-readiness')).toBe('R4');
    expect(el.getAttribute('data-readiness-state')).toBe('reached');
  });
});

describe('StatusCell — the two off-ladder states read as non-progress', () => {
  it('a declared-but-unrun gate renders hatched, dashed and marked waiting', () => {
    const { container } = render(<StatusCell cell={cell('deferred', { tier: 'L4' })} />);
    const el = root(container);
    expect(el.getAttribute('data-readiness-state')).toBe('waiting');
    expect(el.style.background).toContain('repeating-linear-gradient');
    expect(el.style.border).toContain('dashed');
    expect(container.querySelector('[data-testid="readiness-code"]')?.textContent).toBe('R4⋯');
  });

  it('a reached R4 renders SOLID, distinguishing it from the waiting cell above', () => {
    const { container } = render(<StatusCell cell={cell('verified', { tier: 'L4' })} />);
    const el = root(container);
    expect(el.style.background).not.toContain('repeating-linear-gradient');
    expect(el.style.border).not.toContain('dashed');
    expect(container.querySelector('[data-testid="readiness-code"]')?.textContent).toBe('R4');
  });

  it('a blocked cell carries the ✕ glyph so it survives greyscale', () => {
    const { container } = render(
      <StatusCell cell={cell('attention', { counts: { pass: 1, deferred: 0, fail: 0, pending: 0 } })} />,
    );
    expect(root(container).getAttribute('data-readiness-state')).toBe('blocked');
    expect(container.querySelector('[data-testid="readiness-code"]')?.textContent).toContain('✕');
  });

  it('R0 renders hollow with a dashed frame so bottlenecks pop', () => {
    const { container } = render(<StatusCell cell={cell('unwired')} />);
    const el = root(container);
    expect(el.getAttribute('data-readiness')).toBe('R0');
    expect(el.style.background).toBe('transparent');
    expect(el.style.border).toContain('dashed');
  });
});

describe('StatusCell — the parallel craft (A-axis) chip', () => {
  const craft = (level: 'A0' | 'A2' | 'A3', state: 'gauged' | 'at-ceiling' | 'stale') => ({
    craft: { level, state, because: 'test' },
    lens: '3d-art' as const,
    deliverable: '3d-mesh' as const,
    ceiling: 'A2' as const,
  });

  it('renders no craft chip at all when no reading is passed (absence ≠ A0)', () => {
    const { container } = render(<StatusCell cell={cell('trusted')} />);
    expect(container.querySelector('[data-testid="craft-code"]')).toBeNull();
  });

  it('renders the level + state as text, with the at-ceiling glyph', () => {
    const { container } = render(<StatusCell cell={cell('verified')} craft={craft('A2', 'at-ceiling')} />);
    const chip = container.querySelector('[data-testid="craft-code"]');
    expect(chip?.textContent).toBe('A2^');
    expect(chip?.getAttribute('data-craft-state')).toBe('at-ceiling');
  });

  it('marks a stale gauge with the ~ glyph so it survives greyscale', () => {
    const { container } = render(<StatusCell cell={cell('trusted')} craft={craft('A3', 'stale')} />);
    expect(container.querySelector('[data-testid="craft-code"]')?.textContent).toBe('A3~');
  });

  it('speaks the craft reading, lens and roof in the cell label', () => {
    const { container } = render(<StatusCell cell={cell('trusted')} craft={craft('A0', 'gauged')} />);
    const label = root(container).getAttribute('aria-label') ?? '';
    expect(label).toContain('lens 3d-art');
    expect(label).toContain('roof A2');
  });
});

describe('StatusCell — the acceptance tier survives as metadata', () => {
  it('keeps L0–L4 reachable in the label as evidence class, not as a rating', () => {
    const { container } = render(<StatusCell cell={cell('trusted', { tier: 'L2' })} />);
    const label = root(container).getAttribute('aria-label') ?? '';
    expect(label).toContain('evidence class L2');
    expect(label).toContain('R3 REVIEWED');
  });

  it('names the engine, and says "no engine" when nothing can produce the step', () => {
    const { container: a } = render(<StatusCell cell={cell('trusted')} />);
    expect(a.textContent).toContain('Claude');
    const { container: b } = render(<StatusCell cell={cell('unpowered')} />);
    expect(b.textContent).toContain('no engine');
  });
});
