import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ItemDNAGenomeEditor } from '@/components/modules/core-engine/sub_inventory/dna-genome';
import { useItemGenomeStore } from '@/stores/itemGenomeStore';

/**
 * scan-sweep inventory-genome-economy: "Build Code" and "Import" are disclosure toggles
 * (each opens a panel and closes the other) but announced as plain buttons with no
 * open/closed state.
 */

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

beforeEach(() => {
  useItemGenomeStore.getState().resetToPresets();
});

afterEach(cleanup);

describe('Item DNA header toggles', () => {
  it('Build Code / Import expose aria-expanded and stay mutually exclusive', () => {
    render(<ItemDNAGenomeEditor moduleId="arpg-inventory" />);
    const exportBtn = screen.getByRole('button', { name: /Build Code/ });
    const importBtn = screen.getByRole('button', { name: /^Import$/ });
    expect(exportBtn.getAttribute('aria-expanded')).toBe('false');
    expect(importBtn.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(exportBtn);
    expect(exportBtn.getAttribute('aria-expanded')).toBe('true');
    expect(importBtn.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(importBtn);
    expect(exportBtn.getAttribute('aria-expanded')).toBe('false');
    expect(importBtn.getAttribute('aria-expanded')).toBe('true');
  });
});
