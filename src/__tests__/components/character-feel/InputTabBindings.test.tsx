import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

const execute = vi.fn();
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

import { InputTab } from '@/components/modules/core-engine/sub_character/input/InputTab';
import { KeyboardMetric } from '@/components/modules/core-engine/sub_character/metrics/BlueprintMetrics';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import type { SubModuleId } from '@/types/modules';

const store = useCharacterBlueprintStore;
const MODULE = 'arpg-character' as SubModuleId;
const renderTab = () => render(<InputTab moduleId={MODULE} featureMap={new Map()} />);

beforeEach(() => {
  execute.mockClear();
  store.getState().resetBindings();
});

afterEach(() => cleanup());

// Each case renders the whole Input tab (abilities grid, table, keyboard); under a
// parallel full-suite run that can exceed the 5 s default, so the budget is explicit.
describe('Input tab - one resolved binding state drives every surface', { timeout: 20_000 }, () => {
  it('case 4 (render): a stored rebind reaches keycaps, legend and the Features metric', () => {
    store.getState().setBindingOverride('IA_Dodge', 'Ctrl');
    renderTab();
    expect(screen.getByLabelText('Space: unbound')).toBeTruthy();
    expect(screen.getByLabelText('Ctrl: IA_Dodge')).toBeTruthy();
    expect(screen.getByText('19 bindings active')).toBeTruthy();
    expect(screen.queryByText(/conflicts? detected/i)).toBeNull();
    cleanup();

    render(<KeyboardMetric />);
    expect(screen.getByTestId('keyboard-metric').textContent).toBe('0conflicts');
  });

  it('case 4 (render): a conflicting rebind is counted from the resolved keyMap everywhere', () => {
    store.getState().setBindingOverride('IA_Dodge', 'W');
    renderTab();
    expect(screen.getByText('18 bindings active')).toBeTruthy();
    expect(screen.getByLabelText('Space: unbound')).toBeTruthy();
    expect(screen.getByText('1 conflict')).toBeTruthy();
    cleanup();
    render(<KeyboardMetric />);
    expect(screen.getByTestId('keyboard-metric').textContent).toBe('1conflict');
  });

  it('a rebind made in the table survives an unmount (tab switch)', () => {
    const first = renderTab();
    fireEvent.click(screen.getByTestId('rebind-action-IA_Dodge'));
    fireEvent.keyDown(window, { key: 'Control' });
    expect(store.getState().bindingOverrides).toEqual({ IA_Dodge: 'Ctrl' });
    first.unmount();
    renderTab();
    expect(within(screen.getByTestId('rebind-action-IA_Dodge')).getByText('Ctrl')).toBeTruthy();
    expect(screen.getByLabelText('Ctrl: IA_Dodge')).toBeTruthy();
  });

  it('Apply to IMC dispatches only on click, and is disabled at defaults and on conflicts', () => {
    renderTab();
    // getByText, not getByRole: role resolution over the whole tab is slow under suite load.
    const apply = () => screen.getByText('Apply to IMC_Default').closest('button') as HTMLButtonElement;
    expect(apply().disabled).toBe(true);
    expect(screen.getByText(/matches defaults/i)).toBeTruthy();
    cleanup();

    store.getState().setBindingOverride('IA_Dodge', 'W');
    renderTab();
    expect(apply().disabled).toBe(true);
    cleanup();

    store.getState().resetBindings();
    store.getState().setBindingOverride('IA_Dodge', 'Ctrl');
    renderTab();
    expect(apply().disabled).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    fireEvent.click(apply());
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toContain('IA_Dodge: Space -> Ctrl');
  });
});
