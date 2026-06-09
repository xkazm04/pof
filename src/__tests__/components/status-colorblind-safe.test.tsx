import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BudgetAlerting } from '@/components/modules/core-engine/sub_save/schema/BudgetAlerting';
import { DataRecoveryTool } from '@/components/modules/core-engine/sub_save/advanced/DataRecoveryTool';
import { PowerCurveDangerZones } from '@/components/modules/core-engine/sub_progression/analysis/PowerCurveDangerZones';
import { StatusTag } from '@/components/ui/StatusTag';

afterEach(cleanup);

// Verifies the colorblind-safe rollout: every spot that used to lean on
// red/amber/green alone now pairs the color with a glyph and/or a shape.
describe('colorblind-safe status encoding', () => {
  it('StatusTag pairs the word with a glyph and an accessible label', () => {
    const { container } = render(<StatusTag level="bad" />);
    const badge = container.querySelector('[data-status="bad"]');
    expect(badge).toBeTruthy();
    expect(badge?.querySelector('svg')).toBeTruthy();          // glyph cue
    expect(badge?.getAttribute('aria-label')).toBeTruthy();    // SR label
    expect(badge?.textContent).toContain('OVER');              // text label kept
    expect(badge?.className).toContain('uppercase');
  });

  it('BudgetAlerting renders a glyph beside every status badge', () => {
    const { container } = render(<BudgetAlerting />);
    const badges = container.querySelectorAll('[data-status]');
    // header summary badge + one badge per section row
    expect(badges.length).toBeGreaterThanOrEqual(4);
    for (const b of badges) {
      expect(b.querySelector('svg')).toBeTruthy();
      expect(b.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('DataRecoveryTool marks non-OK bars with a shape hatch, not color alone', () => {
    const { container } = render(<DataRecoveryTool />);
    // WorldState (partial) + Metadata (lost) bars carry a repeating-gradient hatch.
    expect(container.innerHTML).toContain('repeating-linear-gradient');
    // The summary tallies keep their words, now each fronted by a glyph.
    expect(container.textContent).toContain('recovered');
    expect(container.textContent).toContain('partial');
    expect(container.textContent).toContain('lost');
  });

  it('PowerCurveDangerZones legend fronts each zone with a distinct glyph', () => {
    const { container } = render(<PowerCurveDangerZones />);
    for (const label of ['Easy', 'Balanced', 'Hard']) {
      const item = container.querySelector(`[title^="${label}:"]`);
      expect(item).toBeTruthy();
      expect(item?.querySelector('svg')).toBeTruthy();
      expect(item?.textContent).toContain(label);
    }
  });
});
