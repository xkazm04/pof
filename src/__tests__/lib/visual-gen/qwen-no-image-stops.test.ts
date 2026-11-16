import { describe, expect, it, vi } from 'vitest';
import { runQwenImage } from '@/lib/visual-gen/qwen-image-runner';

describe('runQwenImage: only a quota wall falls through the paid chain', () => {
  it('a 200 with no image stops at the model that answered', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ output: { choices: [] } }), { status: 200 }));
    const writeFile = vi.fn(async () => {});
    const r = await runQwenImage(
      { prompt: 'p', outputPath: 'o.png', apiKey: 'k', model: 'a', fallbackModels: ['b', 'c'] },
      { fetch: fetchMock as unknown as typeof fetch, writeFile, now: () => 1 },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('no image in the a response');
    expect(r.model).toBe('a');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
