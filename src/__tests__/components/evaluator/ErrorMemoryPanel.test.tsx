import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ErrorMemoryPanel } from '@/components/modules/evaluator/ErrorMemoryPanel';
import type { ErrorMemoryStats } from '@/lib/error-memory-db';

afterEach(cleanup);

describe('ErrorMemoryPanel', () => {
  it('renders the empty state when no errors have been recorded', () => {
    const stats: ErrorMemoryStats = {
      totalErrors: 0,
      uniqueFingerprints: 0,
      unresolvedCount: 0,
      topCategories: [],
      topPatterns: [],
    };
    const { getByTestId } = render(<ErrorMemoryPanel initialStats={stats} />);
    const empty = getByTestId('error-memory-empty');
    expect(empty.textContent?.toLowerCase()).toContain('mistakes the assistant now avoids');
  });

  it('renders the 3 stat tiles with the correct values', () => {
    const stats: ErrorMemoryStats = {
      totalErrors: 17,
      uniqueFingerprints: 6,
      unresolvedCount: 2,
      topCategories: [{ category: 'missing-include', count: 9, unresolved: 1 }],
      topPatterns: [],
    };
    const { container } = render(<ErrorMemoryPanel initialStats={stats} />);
    expect(container.querySelector('[data-stat="total"]')?.textContent).toBe('17');
    expect(container.querySelector('[data-stat="unique"]')?.textContent).toBe('6');
    expect(container.querySelector('[data-stat="unresolved"]')?.textContent).toBe('2');
  });

  it('shows category rows with humanized labels + severity-tagged frequency bars', () => {
    const stats: ErrorMemoryStats = {
      totalErrors: 30,
      uniqueFingerprints: 10,
      unresolvedCount: 3,
      topCategories: [
        { category: 'unresolved-external', count: 12, unresolved: 1 },
        { category: 'missing-include', count: 9, unresolved: 0 },
        { category: 'syntax', count: 3, unresolved: 0 },
      ],
      topPatterns: [],
    };
    const { container } = render(<ErrorMemoryPanel initialStats={stats} />);
    const rows = Array.from(container.querySelectorAll('[data-category]'));
    expect(rows).toHaveLength(3);
    // Humanized label appears (from CATEGORY_LABELS).
    expect(container.textContent).toContain('Linker / unresolved external');
    expect(container.textContent).toContain('Missing #include');
    expect(container.textContent).toContain('Syntax error');
    // Severity classification reflects the mapping.
    expect(rows[0].getAttribute('data-severity')).toBe('critical');
    expect(rows[1].getAttribute('data-severity')).toBe('high');
    expect(rows[2].getAttribute('data-severity')).toBe('low');
  });

  it('marks fully-resolved categories distinctly from unresolved ones', () => {
    const stats: ErrorMemoryStats = {
      totalErrors: 7,
      uniqueFingerprints: 2,
      unresolvedCount: 1,
      topCategories: [
        { category: 'missing-include', count: 4, unresolved: 1 }, // unresolved
        { category: 'syntax', count: 3, unresolved: 0 },          // resolved
      ],
      topPatterns: [],
    };
    const { container } = render(<ErrorMemoryPanel initialStats={stats} />);
    const inc = container.querySelector('[data-category="missing-include"]')!;
    const syn = container.querySelector('[data-category="syntax"]')!;
    expect(inc.getAttribute('data-resolved')).toBe('false');
    expect(syn.getAttribute('data-resolved')).toBe('true');
  });
});
