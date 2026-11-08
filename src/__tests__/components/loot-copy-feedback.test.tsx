import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { resetLootTuning } from '@/components/modules/core-engine/sub_loot/_shared/lootTuningStore';
import { EnemyLootBindingSection } from '@/components/modules/core-engine/sub_loot/core/EnemyLootBinding';
import { LootTableEditor } from '@/components/modules/core-engine/sub_loot/affix/LootTableEditor';

// The loot module's two Copy buttons must report what the clipboard actually did:
// "Copied" only after writeText resolves, never after it rejects (insecure context,
// no document focus) - the shared copyToClipboard contract (src/lib/clipboard.ts).

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  resetLootTuning();
  writeText.mockReset();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(cleanup);

const buttonByText = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('Enemy loot C++ copy', () => {
  it('does not claim Copied when the clipboard write rejects', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    const { container } = render(<EnemyLootBindingSection />);
    fireEvent.click(buttonByText(container, 'C++')!);
    fireEvent.click(buttonByText(container, 'Copy')!);
    await flush();
    expect(buttonByText(container, 'Copied')).toBeUndefined();
    expect(buttonByText(container, 'Copy')).toBeDefined();
  });

  it('claims Copied once the write resolves', async () => {
    writeText.mockResolvedValue(undefined);
    const { container } = render(<EnemyLootBindingSection />);
    fireEvent.click(buttonByText(container, 'C++')!);
    fireEvent.click(buttonByText(container, 'Copy')!);
    await flush();
    expect(buttonByText(container, 'Copied')).toBeDefined();
  });
});

describe('Loot table re-export copy', () => {
  it('does not claim Copied when the clipboard write rejects', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    const { container } = render(<LootTableEditor />);
    fireEvent.click(buttonByText(container, 'Re-export')!);
    fireEvent.click(buttonByText(container, 'Copy')!);
    await flush();
    expect(buttonByText(container, 'Copied')).toBeUndefined();
  });

  it('claims Copied once the write resolves', async () => {
    writeText.mockResolvedValue(undefined);
    const { container } = render(<LootTableEditor />);
    fireEvent.click(buttonByText(container, 'Re-export')!);
    fireEvent.click(buttonByText(container, 'Copy')!);
    await flush();
    expect(buttonByText(container, 'Copied')).toBeDefined();
  });
});
