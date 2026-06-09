/**
 * Regression guard for "Raise muted micro-text to WCAG AA contrast" in the bestiary.
 *
 * The breadcrumb separators / inactive steps and the BT-flowchart badges / inactive node
 * labels used to combine sub-floor sizes (text-[9px]/text-[10px]) with opacity-dimmed muted
 * color (text-text-muted/40–/70, opacity-50, white@50%) — all well below 4.5:1. They now
 * route through the shared `MicroLabel` primitive / the `--text-subtle` tier, so every label
 * sits at the 12px floor in an AA-compliant color.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { NarrativeBreadcrumb } from '@/components/modules/core-engine/sub_bestiary/NarrativeBreadcrumb';
import { BTFlowchartRow } from '@/components/modules/core-engine/sub_bestiary/ai-logic/BTFlowchartRow';
import type { FlatRow } from '@/components/modules/core-engine/sub_bestiary/ai-logic/bt-flowchart-utils';
import { STATUS_INFO } from '@/lib/chart-colors';

afterEach(cleanup);

/** Sub-12px-floor literals that must never appear in this micro-text. */
const SUB_FLOOR = ['text-[9px]', 'text-[10px]', 'text-[11px]'];
/** The opacity-dimmed muted colors these views used to fall below AA with. */
const OPACITY_MUTED = /text-text-muted\/(40|50|60|70)/;

describe('NarrativeBreadcrumb micro-text', () => {
  it('uses the 12px floor and no opacity-dimmed muted separators', () => {
    const { container } = render(<NarrativeBreadcrumb activeTab="features" onNavigate={() => {}} />);
    const root = container.firstElementChild as HTMLElement;
    const html = container.innerHTML;
    for (const banned of SUB_FLOOR) expect(html).not.toContain(banned);
    expect(OPACITY_MUTED.test(html)).toBe(false);
    expect(root.className).toContain('text-xs'); // 12px floor on the container
    // inactive (future) steps are painted with the AA subtle token, not muted@0.5
    expect(html).toContain('--text-subtle');
  });

  it('inactive step buttons no longer dim themselves with opacity:0.5', () => {
    const { container } = render(<NarrativeBreadcrumb activeTab="features" onNavigate={() => {}} />);
    for (const b of container.querySelectorAll('button')) {
      expect((b as HTMLElement).style.opacity).not.toBe('0.5');
    }
  });
});

describe('BTFlowchartRow micro-text', () => {
  const inactiveRow: FlatRow = {
    node: { id: 'flee', label: 'Flee', shape: 'rounded', active: false, details: '', children: [] },
    depth: 1,
    hasChildren: false,
  };

  function renderRow() {
    return render(
      <BTFlowchartRow
        row={inactiveRow}
        idx={0}
        isSelected={false}
        isMatch={undefined}
        isCollapsed={false}
        accent={STATUS_INFO}
        onNodeClick={() => {}}
        onToggleCollapse={() => {}}
        onKeyDown={() => {}}
      />,
    );
  }

  it('drops text-[9px] / opacity-50 / muted-opacity for the AA subtle tier', () => {
    const { container } = renderRow();
    const html = container.innerHTML;
    for (const banned of SUB_FLOOR) expect(html).not.toContain(banned);
    expect(OPACITY_MUTED.test(html)).toBe(false);
    expect(html).not.toContain('opacity-50');
    // inactive node label painted with --text-subtle (was white@50% under opacity-50)
    expect(html).toContain('--text-subtle');
  });

  it('renders the shape badge as a 12px-floor subtle MicroLabel', () => {
    const { container } = renderRow();
    const badge = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === 'Task');
    expect(badge).toBeTruthy();
    expect(badge!.className).toContain('text-xs');
    expect(badge!.className).toContain('text-text-subtle');
  });
});
