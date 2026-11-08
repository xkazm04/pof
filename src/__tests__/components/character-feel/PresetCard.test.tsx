import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PresetCard } from '@/components/modules/core-engine/sub_character/ai-feel/PresetCard';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';

afterEach(() => cleanup());

const PRESET = FEEL_PRESETS[0];

/* Selecting a base preset is the AI Feel tab's primary action. It must be a
 * native button with announced pressed state (registry: accessibility /
 * primitive-level-a11y, native-first), not a clickable container that a
 * keyboard can never reach. */
describe('PresetCard', () => {
  it('exposes selection as a native button carrying aria-pressed', () => {
    const onSelect = vi.fn();
    render(<PresetCard preset={PRESET} isSelected={true} isCompareTarget={false} onSelect={onSelect} onCompare={vi.fn()} />);
    const select = screen.getByRole('button', { name: new RegExp(PRESET.name) });
    expect(select.tagName).toBe('BUTTON');
    expect(select.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(select);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('keeps Compare a separate button that does not select', () => {
    const onSelect = vi.fn();
    const onCompare = vi.fn();
    render(<PresetCard preset={PRESET} isSelected={false} isCompareTarget={false} onSelect={onSelect} onCompare={onCompare} />);
    const compare = screen.getByRole('button', { name: /compare/i });
    expect(compare.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(compare);
    expect(onCompare).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    // No button nested inside another button (invalid interactive nesting).
    expect(compare.parentElement?.closest('button')).toBeNull();
  });
});
