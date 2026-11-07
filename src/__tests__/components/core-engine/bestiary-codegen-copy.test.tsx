/**
 * The GameplayEffect codegen modal's Copy button must report what happened: the raw
 * navigator.clipboard.writeText call it used left a rejected promise unhandled (no
 * secure context / no focus) and showed nothing either way.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { CodegenModal } from '@/components/modules/core-engine/sub_bestiary/archetypes/CodegenModal';
import { ELITE_MODIFIERS } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function stubClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

function copyButton() {
  return [...document.querySelectorAll('button')].find(b => /cop(y|ied)/i.test(b.textContent ?? ''))!;
}

describe('CodegenModal copy feedback', () => {
  it('says "Copied" after a successful write', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    render(<CodegenModal mod={ELITE_MODIFIERS[0]} onClose={() => {}} />);
    fireEvent.click(copyButton());
    await waitFor(() => expect(copyButton().textContent).toContain('Copied'));
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('says "Copy failed" (and does not throw) when the clipboard rejects', async () => {
    stubClipboard(() => Promise.reject(new Error('NotAllowedError')));
    render(<CodegenModal mod={ELITE_MODIFIERS[0]} onClose={() => {}} />);
    fireEvent.click(copyButton());
    await waitFor(() => expect(copyButton().textContent).toContain('Copy failed'));
  });
});
