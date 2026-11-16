import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { InventoryGridDesigner } from '@/components/modules/content/ui-hud/InventoryGridDesigner';
import { useHudDesignStore } from '@/stores/hudDesignStore';
import { useProjectStore } from '@/stores/projectStore';
import { DEFAULT_CONFIG } from '@/lib/prompts/inventory';

beforeEach(() => {
  localStorage.clear();
  useHudDesignStore.setState({ byProject: {} });
  useProjectStore.setState({ projectPath: 'C:/P1', projectName: 'PoF', ueVersion: '5.8.0' });
  useHudDesignStore.getState().setInventoryDraft('C:/P1', { ...DEFAULT_CONFIG, stackable: true, maxStackSize: 20 });
});
afterEach(() => cleanup());

const field = () => screen.getByLabelText('Stack limit') as HTMLInputElement;
const stored = () => useHudDesignStore.getState().getInventoryDraft('C:/P1').maxStackSize;

describe('Inventory Stack Limit draft', () => {
  it('clear then type 5 yields 5, committed on blur', () => {
    render(<InventoryGridDesigner onGenerate={() => {}} isGenerating={false} />);
    fireEvent.change(field(), { target: { value: '' } });
    expect(field().value).toBe('');
    fireEvent.change(field(), { target: { value: '5' } });
    expect(field().value).toBe('5');
    fireEvent.blur(field());
    expect(stored()).toBe(5);
    expect(field().value).toBe('5');
  });

  it('blur on empty or 0 clamps to 1; large clamps to 9999', () => {
    render(<InventoryGridDesigner onGenerate={() => {}} isGenerating={false} />);
    fireEvent.change(field(), { target: { value: '' } });
    fireEvent.blur(field());
    expect(stored()).toBe(1);
    fireEvent.change(field(), { target: { value: '99999' } });
    fireEvent.blur(field());
    expect(stored()).toBe(9999);
  });
});
