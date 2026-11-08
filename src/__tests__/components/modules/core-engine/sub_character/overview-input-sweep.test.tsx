import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { AbilityQuickPicker } from '@/components/modules/core-engine/sub_character/input/AbilityQuickPicker';
import { COMBO_ABILITIES } from '@/components/modules/core-engine/sub_ability/_shared/data';

import { OptimizerMetric, DodgeMetric } from '@/components/modules/core-engine/sub_character/metrics/MovementMetrics';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import { resolveBindings, normalizeKeyEvent } from '@/lib/character/input-bindings';
import { INPUT_BINDINGS } from '@/components/modules/core-engine/sub_character/_shared/data';
import { buildBindingsApplyPrompt } from '@/components/modules/core-engine/sub_character/input/build-bindings-apply-prompt';

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

describe('Apply-to-IMC prompt names real UE EKeys for every capturable key', () => {
  // KeyboardEvent.key -> the EKeys name UE expects (FKey names from InputCoreTypes).
  const CASES: Array<[string, string]> = [
    ['-', 'Hyphen'], ['=', 'Equals'], ['[', 'LeftBracket'], [']', 'RightBracket'],
    ['\\', 'Backslash'], [';', 'Semicolon'], ["'", 'Apostrophe'], [',', 'Comma'],
    ['.', 'Period'], ['/', 'Slash'], ['`', 'Tilde'], ['Backspace', 'BackSpace'],
    ['Meta', 'LeftCommand'],
  ];
  it.each(CASES)('a rebind captured as %s is written as EKeys::%s', (eventKey, ue) => {
    const label = normalizeKeyEvent(eventKey);
    const prompt = buildBindingsApplyPrompt(resolveBindings(INPUT_BINDINGS, { IA_Interact: label }));
    expect(prompt).toContain(`IA_Interact: E -> ${label} (EKeys::${ue})`);
  });
});
