/**
 * Regression guard for "Clamp genome number inputs on blur, not per-keystroke".
 *
 * The number inputs in ProfileSection and LevelScaledPowerCurve must:
 *   - keep raw text while focused (no per-keystroke clamp / no mid-edit snap),
 *   - validate + clamp only on blur/Enter (commit),
 *   - revert empty/NaN to the previous valid value (never produce NaN),
 *   - drop the hardcoded `focus:border-blue-500/50` for the shared
 *     `.focus-ring-inset` token reading a section `--focus-accent`.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Activity } from 'lucide-react';
import { ProfileSection } from '@/components/modules/core-engine/sub_character/genome/ProfileSection';
import { LevelScaledPowerCurve } from '@/components/modules/core-engine/sub_character/genome/LevelScaledPowerCurve';
import type { FieldDef } from '@/components/modules/core-engine/sub_character/genome/types';
import { createGenome } from '@/lib/genome/defaults';
import { ACCENT_CYAN, ACCENT_VIOLET } from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const FIELD: FieldDef = { key: 'baseDamage', label: 'Base Damage', unit: '', min: 1, max: 200, step: 1 };
const ACCENT = ACCENT_CYAN;

function renderProfile(onChange = vi.fn()) {
  const result = render(
    <ProfileSection
      title="Combat"
      icon={Activity}
      color={ACCENT}
      fields={[FIELD]}
      values={{ baseDamage: 25 }}
      onChange={onChange}
    />,
  );
  return { ...result, onChange, input: screen.getByRole('spinbutton') as HTMLInputElement };
}

describe('ProfileSection number input', () => {
  it('keeps raw text while editing — no clamp / commit per keystroke', () => {
    const { input, onChange } = renderProfile();
    fireEvent.change(input, { target: { value: '999' } });
    expect(input.value).toBe('999'); // raw preserved, not snapped back to 25
    expect(onChange).not.toHaveBeenCalled(); // not clamped mid-entry
  });

  it('validates and clamps to max on blur', () => {
    const { input, onChange } = renderProfile();
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('baseDamage', 200);
    expect(input.value).toBe('200'); // display normalized to committed value
  });

  it('commits on Enter', () => {
    const { input, onChange } = renderProfile();
    input.focus(); // Enter commits by blurring the focused field
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('baseDamage', 1); // clamped to min
  });

  it('reverts empty input to the previous valid value on blur — never NaN', () => {
    const { input, onChange } = renderProfile();
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe(''); // empty allowed mid-edit
    fireEvent.blur(input);
    expect(input.value).toBe('25'); // restored to previous valid value
    expect(onChange).not.toHaveBeenCalled(); // no NaN pushed up
  });

  it('uses the shared focus-ring token under a --focus-accent region (no hardcoded blue)', () => {
    const { container, input } = renderProfile();
    expect(input.className).toContain('focus-ring-inset');
    expect(container.innerHTML).not.toContain('border-blue-500');
    expect(container.querySelector('[style*="--focus-accent"]')).not.toBeNull();
  });
});

describe('LevelScaledPowerCurve level input', () => {
  function renderCurve() {
    const genome = createGenome('Test', ACCENT_VIOLET);
    const result = render(<LevelScaledPowerCurve genomes={[genome]} activeId={genome.id} />);
    return { ...result, input: screen.getByRole('spinbutton') as HTMLInputElement };
  }

  it('keeps raw text while editing and clamps to max only on blur', () => {
    const { input } = renderCurve();
    fireEvent.change(input, { target: { value: '999' } });
    expect(input.value).toBe('999'); // raw preserved mid-edit (was rejected per-keystroke before)
    fireEvent.blur(input);
    expect(input.value).toBe('100'); // clamped on commit
  });

  it('reverts empty input to the previous valid level on blur', () => {
    const { input } = renderCurve();
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    fireEvent.blur(input);
    expect(input.value).toBe('50'); // previewLevel default restored
  });

  it('uses the shared focus-ring token (no hardcoded blue)', () => {
    const { container, input } = renderCurve();
    expect(input.className).toContain('focus-ring-inset');
    expect(container.innerHTML).not.toContain('border-blue-500');
    expect(container.querySelector('[style*="--focus-accent"]')).not.toBeNull();
  });
});
