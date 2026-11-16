import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

import { MaterialStyleTransfer } from '@/components/modules/content/materials/MaterialStyleTransfer';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * /api/style-transfer reads the TEXT description only (it returns
 * imageAnalyzed: false and its prose says the image was NOT examined — pinned in
 * style-transfer-image-claims.test.ts). The panel around it still sold image
 * analysis: "Upload a reference screenshot to generate matching UE5 materials",
 * a spinner reading "Analyzing visual properties...", and a compare pane titled
 * "Analyzed Properties" beside the screenshot. The copy must claim only what
 * the analyzer reads.
 */

const PHANTOM = [/analyzing visual properties/i, /upload a reference screenshot to generate/i, /analyzed properties/i];

describe('MaterialStyleTransfer copy claims only what is read', () => {
  it('the idle panel does not promise screenshot-driven matching', () => {
    const { container } = render(<MaterialStyleTransfer onGenerate={() => {}} isGenerating={false} />);
    for (const re of PHANTOM) expect(container.textContent).not.toMatch(re);
    expect(container.textContent).toMatch(/describe a look/i);
  });

  it('the in-flight spinner does not say the image is being analyzed', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const { container } = render(<MaterialStyleTransfer onGenerate={() => {}} isGenerating={false} />);
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'brushed metal' } });
    const analyze = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Analyze'))!;
    await act(async () => { fireEvent.click(analyze); });
    for (const re of PHANTOM) expect(container.textContent).not.toMatch(re);
  });
});
