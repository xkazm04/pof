import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { CombatChoreographyEditor } from '@/components/modules/core-engine/sub_combat/choreography';
import { resetEncounterDraft } from '@/components/modules/core-engine/sub_combat/choreography/encounterDraftStore';

const realClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});
beforeEach(() => resetEncounterDraft());
afterEach(() => {
  cleanup();
  if (realClipboard) Object.defineProperty(navigator, 'clipboard', realClipboard);
  else delete (navigator as { clipboard?: unknown }).clipboard;
});

function copyButton(container: HTMLElement): HTMLButtonElement {
  return [...container.querySelectorAll('button')].find((b) => /^copy/i.test(b.textContent?.trim() ?? ''))!;
}

describe('Encounter UE5 export copy', () => {
  it('a rejected clipboard write is caught and reported, never an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (r: unknown) => unhandled.push(r);
    process.on('unhandledRejection', onUnhandled);
    try {
      stubClipboard(vi.fn(() => Promise.reject(new Error('denied'))));
      const { container } = render(<CombatChoreographyEditor />);
      const btn = copyButton(container);
      await act(async () => { fireEvent.click(btn); });
      await new Promise((r) => setTimeout(r, 0));
      expect(unhandled).toEqual([]);
      expect(btn.textContent).toMatch(/failed/i);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('shows Copied after a write that landed', async () => {
    stubClipboard(vi.fn(() => Promise.resolve()));
    const { container } = render(<CombatChoreographyEditor />);
    const btn = copyButton(container);
    await act(async () => { fireEvent.click(btn); });
    expect(btn.textContent?.trim()).toBe('Copied');
  });
});
