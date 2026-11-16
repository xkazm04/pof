/**
 * The C++ export string is built only while the Export panel is open: with it
 * hidden, state changes (random rolls re-render the whole workbench) must not
 * call generateExportCode.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

const codegenSpy = vi.hoisted(() => vi.fn());
vi.mock('@/components/modules/core-engine/sub_loot/affix-workbench/codegen', async (orig) => {
  const real = await orig<typeof import('@/components/modules/core-engine/sub_loot/affix-workbench/codegen')>();
  return { ...real, generateExportCode: (...args: Parameters<typeof real.generateExportCode>) => { codegenSpy(); return real.generateExportCode(...args); } };
});

import { AffixCraftingWorkbench } from '@/components/modules/core-engine/sub_loot/affix-workbench';

afterEach(() => cleanup());

const button = (root: HTMLElement, text: string) => {
  const b = [...root.querySelectorAll('button')].find((x) => x.textContent?.trim() === text);
  if (!b) throw new Error(`no button ${text}`);
  return b;
};

describe('AffixCraftingWorkbench — export code is lazy', () => {
  it('builds no export string across 10 re-renders while Export is closed, and builds it once opened', () => {
    const { container } = render(<AffixCraftingWorkbench moduleId={'arpg-loot' as never} />);
    codegenSpy.mockClear();
    for (let i = 0; i < 10; i++) fireEvent.click(button(container, 'Random Roll'));
    expect(codegenSpy).toHaveBeenCalledTimes(0);
    fireEvent.click(button(container, 'Export C++'));
    expect(codegenSpy.mock.calls.length).toBeGreaterThan(0);
    expect(container.textContent).toContain('ItemInstance');
  });
});
