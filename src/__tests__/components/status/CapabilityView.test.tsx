import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { CapabilityView } from '@/components/status/CapabilityView';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// One strict-panel verdict so at least one class has evidence; the rest render as rows too.
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    tryApiFetch: vi.fn().mockResolvedValue({
      ok: true,
      data: [
        { catalogId: 'items', entityId: 'e1', step: 'Concept Brief', judge: 'llm-panel', verdict: 'fail', score: 80, findings: '', model: 'm', rubricVersion: 3 },
      ],
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe('CapabilityView', () => {
  it('renders one row per capability class with a grade token and provenance', async () => {
    const onFilterClass = vi.fn();
    const { container, getByText } = render(<CapabilityView onFilterClass={onFilterClass} />);

    await waitFor(() => {
      // Text & Systems Design label appears once the rows build.
      expect(getByText('Text & Systems Design')).toBeTruthy();
    });

    // The grade word is rendered (colorblind-safe: word, not hue alone).
    expect(container.textContent).toContain('capped');
    // Provenance micro-label present.
    expect(container.textContent).toContain('derived from project instances');

    // Clicking a class row triggers the filter callback with the class id.
    fireEvent.click(getByText('Text & Systems Design').closest('button')!);
    expect(onFilterClass).toHaveBeenCalledWith('text-config');
  });
});
