import { describe, it, expect, vi } from 'vitest';

// The singleton memoised the PROMISE, so one failed `import('shiki')` /
// createHighlighter (a chunk-load blip, a grammar fetch) stayed rejected for the
// life of the tab: every later highlight() rejected and no code viewer in the
// app ever highlighted again until a reload.

const createHighlighter = vi.fn();
vi.mock('shiki', () => ({ createHighlighter: (...args: unknown[]) => createHighlighter(...args) }));

describe('shiki highlighter singleton', () => {
  it('retries after a failed initialisation instead of caching the rejection', async () => {
    const { highlight } = await import('@/lib/shiki-highlighter');
    createHighlighter.mockRejectedValueOnce(new Error('chunk load failed'));
    createHighlighter.mockResolvedValue({ codeToHtml: (code: string) => `<pre>${code}</pre>` });

    await expect(highlight('int x;', 'cpp')).rejects.toThrow('chunk load failed');
    await expect(highlight('int x;', 'cpp')).resolves.toBe('<pre>int x;</pre>');
    expect(createHighlighter).toHaveBeenCalledTimes(2);
  });
});
