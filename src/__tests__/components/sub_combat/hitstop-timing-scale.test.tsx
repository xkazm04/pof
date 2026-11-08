import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FeedbackTab } from '@/components/modules/core-engine/sub_combat/polish/FeedbackTab';
import { FEEDBACK_PARAMS, HITSTOP_ABILITIES } from '@/components/modules/core-engine/sub_combat/_shared/data';

// scan-sweep night 2026-11-08, combat-damage-pipeline: the Hitstop Timing bars are drawn on ONE
// time axis (max animDuration) so a bar's width is its duration, not an arbitrary scale.

afterEach(() => cleanup());

const pct = (el: Element) => parseFloat((el as HTMLElement).style.width);

describe('Hitstop Timing bars read as time', () => {
  const values = Object.fromEntries(FEEDBACK_PARAMS.map(p => [p.id, p.defaultValue]));
  const maxDur = Math.max(...HITSTOP_ABILITIES.map(a => a.animDuration));

  it('every ability draws its anim bar and hitstop bar to one shared duration scale', () => {
    render(<FeedbackTab feedbackValues={values} juiceLevel={0.5} onPreset={() => {}} onParam={() => {}} />);
    const off: string[] = [];
    for (const a of HITSTOP_ABILITIES) {
      const label = screen.getAllByText(a.name).find(el => el.tagName === 'SPAN')!;
      const track = label.parentElement!.querySelector('div.relative')!;
      const [anim, stop] = Array.from(track.children);
      const okAnim = Math.abs(pct(anim) - (a.animDuration / maxDur) * 100) < 0.01;
      const okStop = Math.abs(pct(stop) - (a.hitstop / maxDur) * 100) < 0.01;
      if (!okAnim || !okStop) off.push(a.name);
    }
    expect(off).toEqual([]);
  });
});
