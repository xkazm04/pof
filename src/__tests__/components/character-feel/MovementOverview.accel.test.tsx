import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MovementOverview } from '@/components/modules/core-engine/sub_character/movement/MovementOverview';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';
import { PLAYGROUND_LAYER_ID } from '@/lib/character/feel-curve-codec';

const store = useCharacterBlueprintStore;
afterEach(() => cleanup());
beforeEach(() => store.setState({ feelLayers: [] }));

/** The accel panel's curve line is the stroked path (the area fill has none). */
function curveD(container: HTMLElement): string {
  const panelPaths = Array.from(container.querySelectorAll('svg path[stroke][fill="none"]'));
  const line = panelPaths.find((p) => p.getAttribute('stroke-width') === '2.5');
  return line?.getAttribute('d') ?? '';
}

/* The Movement tab drew a fixed reference curve while the Playground edits the resolved
 * feel stack, so a preset change or a dragged handle moved one tab and not the other. */
describe('MovementOverview — acceleration curve follows the resolved feel stack', () => {
  it('draws a different curve under two presets', () => {
    store.setState({ baseFeelPresetId: FEEL_PRESETS[0].id });
    const a = render(<MovementOverview />);
    const dA = curveD(a.container);
    cleanup();
    store.setState({ baseFeelPresetId: FEEL_PRESETS[1].id });
    const b = render(<MovementOverview />);
    const dB = curveD(b.container);
    expect(dA).not.toBe('');
    expect(dB).not.toBe('');
    expect(dA).not.toBe(dB);
  });

  it('a Playground curve edit in the stack changes the Movement curve', () => {
    store.setState({ baseFeelPresetId: FEEL_PRESETS[0].id });
    const before = curveD(render(<MovementOverview />).container);
    cleanup();
    store.setState({
      feelLayers: [{
        id: PLAYGROUND_LAYER_ID, name: 'Playground curves', enabled: true,
        modifiers: [{ field: 'movement.maxSprintSpeed', op: 'set', value: 1200 }],
      }],
    });
    const after = curveD(render(<MovementOverview />).container);
    expect(after).not.toBe(before);
  });
});
