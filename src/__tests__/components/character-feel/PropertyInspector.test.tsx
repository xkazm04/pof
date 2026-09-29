import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PropertyInspector } from '@/components/modules/core-engine/sub_character/overview/PropertyInspector';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';

const store = useCharacterBlueprintStore;

beforeEach(() => {
  store.setState({ baseFeelPresetId: FEEL_PRESETS[0].id, feelLayers: [] });
});

afterEach(() => cleanup());

describe('PropertyInspector — a view and editor of the persisted feel stack', () => {
  it('case 5 (render): a slider edit lands in the store and survives an unmount', () => {
    const first = render(<PropertyInspector />);
    const slider = screen.getByLabelText('MaxWalkSpeed') as HTMLInputElement;
    expect(slider.value).toBe('320');

    fireEvent.change(slider, { target: { value: '450' } });
    const layer = store.getState().feelLayers.find((l) => l.id === 'inspector-overrides');
    expect(layer?.modifiers).toEqual([{ field: 'movement.maxWalkSpeed', op: 'set', value: 450 }]);

    first.unmount();
    render(<PropertyInspector />);
    expect((screen.getByLabelText('MaxWalkSpeed') as HTMLInputElement).value).toBe('450');
    expect(screen.getByText('450')).toBeTruthy();
  });

  it('states the count of fields that do not reach UE instead of hiding them', () => {
    render(<PropertyInspector />);
    expect(screen.getByText(/3 not applied/i)).toBeTruthy();
  });
});
