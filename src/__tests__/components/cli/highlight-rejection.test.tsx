import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { HighlightedCodeBlock } from '@/components/cli/CodeBlockHighlighter';
import { CodePreview } from '@/components/modules/core-engine/sub_ability/blueprint/CodePreview';

vi.mock('@/lib/shiki-highlighter', () => ({
  getCachedHighlight: () => null,
  highlight: vi.fn(() => Promise.reject(new Error('shiki chunk failed to load'))),
}));

afterEach(cleanup);

async function renderAndWatch(ui: React.ReactElement) {
  const unhandled = vi.fn();
  process.on('unhandledRejection', unhandled);
  try {
    const { container } = render(ui);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    return { unhandled, container };
  } finally {
    process.off('unhandledRejection', unhandled);
  }
}

describe('a failed highlighter load is not an unhandled rejection', () => {
  it('CodeBlockHighlighter keeps the plain <pre>', async () => {
    const { unhandled, container } = await renderAndWatch(<HighlightedCodeBlock code="int x;" lang="cpp" />);
    expect(unhandled).not.toHaveBeenCalled();
    expect(container.querySelector('pre code')?.textContent).toBe('int x;');
  });

  it('the ability CodePreview keeps rendering its code', async () => {
    const { unhandled, container } = await renderAndWatch(<CodePreview code="int y;" prevCode={null} />);
    expect(unhandled).not.toHaveBeenCalled();
    expect(container.textContent).toContain('int y;');
  });
});
