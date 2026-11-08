import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { InventoryGridDesigner } from '@/components/modules/content/ui-hud/InventoryGridDesigner';
import { useHudDesignStore } from '@/stores/hudDesignStore';
import { useProjectStore } from '@/stores/projectStore';
import { DEFAULT_CONFIG } from '@/lib/prompts/inventory';

beforeEach(() => {
  localStorage.clear();
  useHudDesignStore.setState({ byProject: {} });
  useProjectStore.setState({ projectPath: 'C:/P1', projectName: 'PoF', ueVersion: '5.8.0' });
});
afterEach(() => cleanup());

describe('Inventory Generate with zero item types', () => {
  it('is disabled with a stated reason and does not dispatch', () => {
    const onGenerate = vi.fn();
    useHudDesignStore.getState().setInventoryDraft('C:/P1', {
      ...DEFAULT_CONFIG,
      slotTypes: DEFAULT_CONFIG.slotTypes.map((s) => ({ ...s, enabled: false })),
    });
    render(<InventoryGridDesigner onGenerate={onGenerate} isGenerating={false} />);
    const btn = screen.getByText('INITIALIZE_BUILD_SEQUENCE').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(document.body.textContent).toContain('Enable at least one item type');
    fireEvent.click(btn);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('is enabled when at least one type is on', () => {
    const onGenerate = vi.fn();
    render(<InventoryGridDesigner onGenerate={onGenerate} isGenerating={false} />);
    const btn = screen.getByText('INITIALIZE_BUILD_SEQUENCE').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(document.body.textContent).not.toContain('Enable at least one item type');
    fireEvent.click(btn);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
