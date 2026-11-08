import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { AbilityQuickPicker } from '@/components/modules/core-engine/sub_character/input/AbilityQuickPicker';
import { COMBO_ABILITIES } from '@/components/modules/core-engine/sub_ability/_shared/data';

import { OptimizerMetric, DodgeMetric } from '@/components/modules/core-engine/sub_character/metrics/MovementMetrics';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';

afterEach(() => cleanup());

describe('AbilityQuickPicker — no dead buttons', () => {
  it('renders read-only chips (not buttons) when no onSelect is wired', () => {
    const { container } = render(<AbilityQuickPicker />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.textContent).toContain(COMBO_ABILITIES[0].name);
  });

  it('keeps one button per ability, and the click reaches onSelect, when wired', () => {
    const picked: string[] = [];
    const { container } = render(<AbilityQuickPicker onSelect={(id) => picked.push(id)} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(COMBO_ABILITIES.length);
    fireEvent.click(buttons[0]);
    expect(picked).toEqual([COMBO_ABILITIES[0].id]);
  });
});

describe('Features-tab metrics read the persisted feel stack', () => {
  it('OptimizerMetric names the persisted base preset instead of a fixed "No preset"', () => {
    for (const preset of FEEL_PRESETS.slice(0, 2)) {
      useCharacterBlueprintStore.setState({ baseFeelPresetId: preset.id, feelLayers: [] });
      const { container, unmount } = render(<OptimizerMetric />);
      expect(container.textContent).toContain(preset.name);
      unmount();
    }
  });

  it('DodgeMetric shows the resolved dodge distance (cm -> m), not a fixed 4.5m', () => {
    for (const preset of FEEL_PRESETS.slice(0, 2)) {
      useCharacterBlueprintStore.setState({ baseFeelPresetId: preset.id, feelLayers: [] });
      const { container, unmount } = render(<DodgeMetric />);
      expect(container.textContent).toContain(`${preset.profile.dodge.distance / 100}m`);
      unmount();
    }
  });
});
