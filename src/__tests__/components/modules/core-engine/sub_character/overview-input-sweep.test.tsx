import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { AbilityQuickPicker } from '@/components/modules/core-engine/sub_character/input/AbilityQuickPicker';
import { COMBO_ABILITIES } from '@/components/modules/core-engine/sub_ability/_shared/data';

import { OptimizerMetric, DodgeMetric } from '@/components/modules/core-engine/sub_character/metrics/MovementMetrics';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import { resolveBindings, normalizeKeyEvent } from '@/lib/character/input-bindings';
import { INPUT_BINDINGS } from '@/components/modules/core-engine/sub_character/_shared/data';
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), sendPrompt: vi.fn(), isRunning: false }),
}));
import { CameraProfileComparison } from '@/components/modules/core-engine/sub_character/overview/CameraProfileComparison';
import { HitboxWireframeViewer } from '@/components/modules/core-engine/sub_character/overview/HitboxWireframeViewer';
import { InputTab } from '@/components/modules/core-engine/sub_character/input/InputTab';
import { ClassHierarchy } from '@/components/modules/core-engine/sub_character/overview/ClassHierarchy';
import { PropertyInspector } from '@/components/modules/core-engine/sub_character/overview/PropertyInspector';
import { CharacterScalingPreview } from '@/components/modules/core-engine/sub_character/overview/CharacterScalingPreview';
import { useNavigationStore } from '@/stores/navigationStore';
import type { SubModuleId } from '@/types/modules';
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

describe('toggle buttons expose their on/off state, not only a tint', () => {
  const pressed = (root: HTMLElement) =>
    [...root.querySelectorAll('button[aria-pressed]')].map((b) => b.getAttribute('aria-pressed'));

  it('camera profile toggles: 6 toggles, the 3 default-selected pressed', () => {
    const { container } = render(<CameraProfileComparison />);
    expect(pressed(container)).toEqual(['true', 'true', 'true', 'false', 'false', 'false']);
  });

  it('hitbox layer toggles: 3 toggles that flip aria-pressed on click', () => {
    const { container } = render(<HitboxWireframeViewer />);
    expect(pressed(container)).toEqual(['true', 'true', 'true']);
    fireEvent.click(container.querySelectorAll('button[aria-pressed]')[1]);
    expect(pressed(container)).toEqual(['true', 'false', 'true']);
  });

  it('ability sort keys: exactly the active key is pressed', () => {
    const { container } = render(<InputTab moduleId={'arpg-character' as SubModuleId} featureMap={new Map()} />);
    expect(pressed(container)).toEqual(['true', 'false', 'false']);
  });
});

describe('disclosure toggles announce what they expand and whether it is open', () => {
  const expanded = (root: HTMLElement) =>
    [...root.querySelectorAll('button[aria-expanded]')].map((b) => b.getAttribute('aria-expanded'));

  it('class tree chevrons are named and expanded (2 parent nodes)', () => {
    const { container } = render(<ClassHierarchy />);
    const toggles = [...container.querySelectorAll('button[aria-expanded]')];
    expect(toggles.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Collapse ACharacter', 'Collapse AARPGCharacterBase',
    ]);
    fireEvent.click(toggles[0]);
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    expect(toggles[0].getAttribute('aria-label')).toBe('Expand ACharacter');
  });

  it('property columns (3) report their collapse state', () => {
    useCharacterBlueprintStore.setState({ baseFeelPresetId: FEEL_PRESETS[0].id, feelLayers: [] });
    const { container } = render(<PropertyInspector />);
    expect(expanded(container)).toEqual(['true', 'true', 'true']);
    fireEvent.click(container.querySelectorAll('button[aria-expanded]')[0]);
    expect(expanded(container)).toEqual(['false', 'true', 'true']);
  });

  it('ability category groups (4 non-empty) report their collapse state', () => {
    const { container } = render(<InputTab moduleId={'arpg-character' as SubModuleId} featureMap={new Map()} />);
    expect(expanded(container)).toEqual(['true', 'true', 'true', 'true']);
  });
});

describe('form controls have an accessible name (placeholder is not one)', () => {
  const named = (root: HTMLElement) =>
    [...root.querySelectorAll('input')].filter((i) => i.getAttribute('aria-label') || i.labels?.length).length;

  it('PropertyInspector search, AbilityQuickPicker search and the scaling level slider are named', () => {
    useCharacterBlueprintStore.setState({ baseFeelPresetId: FEEL_PRESETS[0].id, feelLayers: [] });
    for (const [ui, label] of [
      [<PropertyInspector key="p" />, 'Search properties'],
      [<AbilityQuickPicker key="a" />, 'Search abilities'],
      [<CharacterScalingPreview key="c" />, 'Character level'],
    ] as const) {
      const { container, getByLabelText, unmount } = render(ui);
      expect(getByLabelText(label)).toBeTruthy();
      expect(named(container)).toBe(container.querySelectorAll('input').length);
      unmount();
    }
  });
});

describe('class-tree cross-reference chip does what its link styling promises', () => {
  it('clicking the arpg-enemy-ai chip navigates to that module', () => {
    const { getByRole } = render(<ClassHierarchy />);
    fireEvent.click(getByRole('button', { name: /arpg-enemy-ai/ }));
    expect(useNavigationStore.getState().activeSubModule).toBe('arpg-enemy-ai');
  });
});

describe('keyboard map shows every rebound key, not only the drawn layout', () => {
  afterEach(() => useCharacterBlueprintStore.getState().resetBindings());

  it.each(['Tab', 'Up', 'F1', '-'])('a rebind to %s appears on the map', (key) => {
    useCharacterBlueprintStore.getState().resetBindings();
    useCharacterBlueprintStore.getState().setBindingOverride('IA_Interact', key);
    const { getByLabelText } = render(<InputTab moduleId={'arpg-character' as SubModuleId} featureMap={new Map()} />);
    expect(getByLabelText(`${key}: IA_Interact`)).toBeTruthy();
  });
});

describe('keyboard legend counts what it says it counts', () => {
  it('defaults: 16 actions occupy 19 physical keys, and the legend says keys', () => {
    useCharacterBlueprintStore.getState().resetBindings();
    const { container } = render(<InputTab moduleId={'arpg-character' as SubModuleId} featureMap={new Map()} />);
    expect(container.textContent).toContain('16 actions with unique bindings');
    expect(container.textContent).toContain('19 keys bound');
    expect(container.textContent).not.toContain('bindings active');
  });
});
