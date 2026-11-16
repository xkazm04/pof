import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { BuildPresetPanel } from '@/components/modules/core-engine/sub_progression/builds/BuildPresetPanel';
import { BUILD_PRESETS } from '@/components/modules/core-engine/sub_progression/_shared/data';

afterEach(cleanup);

describe('BuildPresetPanel selection state', () => {
  it('exposes the chosen preset as pressed, not only by colour', () => {
    render(<BuildPresetPanel activeBuild={1} setActiveBuild={() => undefined} />);
    const pressed = BUILD_PRESETS.map((b) => screen.getByRole('button', { name: b.name }).getAttribute('aria-pressed'));
    expect(pressed.filter((p) => p === 'true')).toHaveLength(1);
    expect(pressed.filter((p) => p === 'false')).toHaveLength(BUILD_PRESETS.length - 1);
    expect(pressed[1]).toBe('true');
  });
});
