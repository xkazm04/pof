import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FeelLayerStack } from '@/components/modules/core-engine/sub_character/ai-feel/FeelLayerStack';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import { createLayerFromTemplate, LAYER_TEMPLATES, type AdjustmentLayer } from '@/lib/feel-adjustment-layers';

const BASE = FEEL_PRESETS[0];
const store = useCharacterBlueprintStore;

beforeEach(() => {
  store.setState({ baseFeelPresetId: BASE.id, feelLayers: [] });
});

afterEach(() => cleanup());

function seed(layers: AdjustmentLayer[]) {
  store.setState({ feelLayers: layers });
}

describe('FeelLayerStack', () => {
  it('shows the base preset and an empty-state hint when there are no layers', () => {
    render(<FeelLayerStack basePreset={BASE} />);
    expect(screen.getByText(BASE.name)).toBeTruthy();
    expect(screen.getByText(/No layers/i)).toBeTruthy();
  });

  it('renders a layer with its name and modifier summary', () => {
    const layer: AdjustmentLayer = {
      id: 'x', name: 'Boss Encounter', enabled: true,
      modifiers: [{ field: 'movement.turnRate', op: 'pct', value: -20 }],
    };
    seed([layer]);
    render(<FeelLayerStack basePreset={BASE} />);
    expect(screen.getByText('Boss Encounter')).toBeTruthy();
    expect(screen.getByText('Turn Rate -20%')).toBeTruthy();
  });

  it('toggles a layer off via the enable button', () => {
    const layer: AdjustmentLayer = { id: 'x', name: 'Frenzy', enabled: true, modifiers: [] };
    seed([layer]);
    render(<FeelLayerStack basePreset={BASE} />);
    fireEvent.click(screen.getByRole('button', { name: /Disable Frenzy/i }));
    expect(store.getState().feelLayers[0].enabled).toBe(false);
  });

  it('removes a layer via the remove button', () => {
    const layer: AdjustmentLayer = { id: 'x', name: 'Frenzy', enabled: true, modifiers: [] };
    seed([layer]);
    render(<FeelLayerStack basePreset={BASE} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove Frenzy/i }));
    expect(store.getState().feelLayers).toHaveLength(0);
  });

  it('adds a template layer from the Add-layer menu', () => {
    render(<FeelLayerStack basePreset={BASE} />);
    fireEvent.click(screen.getByRole('button', { name: /Add layer/i }));
    const tpl = LAYER_TEMPLATES[0];
    fireEvent.click(screen.getByText(tpl.name));
    expect(store.getState().feelLayers).toHaveLength(1);
    expect(store.getState().feelLayers[0].name).toBe(tpl.name);
  });

  it('reorders layers with the move-down control', () => {
    seed([
      createLayerFromTemplate(LAYER_TEMPLATES[0].templateId)!,
      createLayerFromTemplate(LAYER_TEMPLATES[1].templateId)!,
    ]);
    const first = store.getState().feelLayers[0];
    render(<FeelLayerStack basePreset={BASE} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Move ${first.name} down`, 'i') }));
    expect(store.getState().feelLayers[1].id).toBe(first.id);
  });
});
