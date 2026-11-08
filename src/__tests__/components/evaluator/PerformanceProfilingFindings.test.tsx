import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { FindingsSection } from '@/components/modules/evaluator/PerformanceProfilingView/FindingsSection';
import type { PerformanceFinding } from '@/types/performance-profiling';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const finding = {
  id: 'f1',
  priority: 'high',
  title: 'Tick storm in BP_Enemy',
  description: 'Fifty enemies tick every frame.',
  involvedClasses: ['BP_Enemy'],
  estimatedSavingsMs: 2.5,
  fixPrompt: 'Lower the tick interval of BP_Enemy.',
  checklistLabel: 'Tick budget',
} as unknown as PerformanceFinding;

function stubClipboard(writeText: () => Promise<void>) {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(writeText) } });
}

function openCard(container: HTMLElement) {
  const header = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(finding.title));
  if (!header) throw new Error('finding header button not found');
  fireEvent.click(header);
  return header;
}

const copyButton = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('button')).find((b) => /^(Copy|Copied!|Copy failed)$/.test(b.textContent?.trim() ?? ''));

describe('FindingsSection copy affordance (ui-controls/micro-interaction-contracts)', () => {
  it('does not flash "Copied!" when the clipboard write is rejected', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    const { container } = render(<FindingsSection findings={[finding]} />);
    openCard(container);
    await act(async () => { fireEvent.click(copyButton(container)!); });
    const label = copyButton(container)?.textContent?.trim();
    expect(label).not.toBe('Copied!');
    expect(label).toBe('Copy failed');
  });

  it('flashes "Copied!" after a verified write', async () => {
    stubClipboard(() => Promise.resolve());
    const { container } = render(<FindingsSection findings={[finding]} />);
    openCard(container);
    await act(async () => { fireEvent.click(copyButton(container)!); });
    expect(copyButton(container)?.textContent?.trim()).toBe('Copied!');
  });
});
