/**
 * The Orrery inspector — the panel the owner said to keep "as is", and the honesty rules it carries.
 *
 * Plain DOM assertions only (no jest-dom in this repo), own `afterEach(cleanup)`.
 */

import fs from 'fs';
import path from 'path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { OrreryPanel } from '@/components/story/orrery/OrreryPanel';
import { buildOrreryModel } from '@/lib/story/orrery';
import type { OrreryModel } from '@/lib/story/orrery';
import { honestyGraph, honestyModel, ix } from '@/__tests__/components/story/orrery/panelFixture';
import { FIXTURES_AVAILABLE, loadGraph } from '@/__tests__/lib/story/orrery/_fixtures';

beforeAll(() => {
  // jsdom has no scrollIntoView, and the audit/search lists call it.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(cleanup);

function panel(model: OrreryModel, selected: number, tab: 'inspect' | 'audit' = 'inspect') {
  const onSelect = vi.fn();
  const onTab = vi.fn();
  const r = render(
    <OrreryPanel
      model={model}
      selected={selected}
      detail={null}
      tab={tab}
      onTab={onTab}
      onSelect={onSelect}
      onCloseDetail={vi.fn()}
      focus={model.root}
    />,
  );
  return { ...r, onSelect, onTab };
}

describe('OrreryPanel — shell and tabs', () => {
  it('emits the winner panel roles: a tablist, the active/idle tabs, a tabpanel body', () => {
    const model = honestyModel();
    const { container } = panel(model, -1);

    const aside = container.querySelector('[data-role=orrery-panel]');
    expect(aside?.tagName).toBe('ASIDE');
    expect(container.querySelector('[data-role=orrery-tabs]')?.getAttribute('role')).toBe('tablist');

    const active = container.querySelector('[data-role=orrery-tab-active]');
    const idle = container.querySelector('[data-role=orrery-tab-idle]');
    expect(active?.getAttribute('aria-selected')).toBe('true');
    expect(idle?.getAttribute('aria-selected')).toBe('false');
    expect(active?.getAttribute('role')).toBe('tab');

    const body = container.querySelector('[data-role=orrery-panelbody]');
    expect(body?.getAttribute('role')).toBe('tabpanel');
    expect(active?.getAttribute('aria-controls')).toBe(body?.getAttribute('id'));
    // The audit count rides the tab, as a count and not a dot.
    expect(container.querySelector('[data-role=orrery-tabcount]')?.textContent).toBe(
      String(model.auditTotal),
    );
  });

  it('keeps panelSect a DIRECT child of the panel body, even with the help card open', () => {
    // Captured inside the help card the same role measures 309px instead of 339px — a 30px failure
    // on a property nobody changed. The contract resolves it with querySelector, so the FIRST one in
    // the document has to be the full-width one.
    const { container } = panel(honestyModel(), -1);
    expect(container.querySelector('[data-role=orrery-wcard]')).not.toBeNull();

    const first = container.querySelector('[data-role=orrery-panel-sect]');
    const firstDirect = container.querySelector(
      '[data-role=orrery-panelbody] > [data-role=orrery-panel-sect]',
    );
    expect(first).not.toBeNull();
    expect(first).toBe(firstDirect);
    // And nothing inside a card carries that role.
    expect(container.querySelector('[data-role=orrery-wcard] [data-role=orrery-panel-sect]')).toBeNull();
  });

  it('shows the document overview when nothing is selected', () => {
    const model = honestyModel();
    const { container } = panel(model, -1);
    expect(container.querySelector('[data-role=orrery-panel-title]')?.textContent).toBe('Inspector Fixture');
    expect(container.querySelector('[data-role=orrery-mono]')?.textContent).toContain('fixture.inspector');
    const body = container.querySelector('[data-role=orrery-panelbody]')?.textContent ?? '';
    expect(body).toContain('none declared');       // no axis in this document
    expect(body).toContain('2 of 6 nodes');        // reach rows, counted not assumed
  });
});

describe('OrreryPanel — unmeasured is not zero', () => {
  it('renders a MEASURED 0% and an UNMEASURED row differently, in three independent ways', () => {
    const model = honestyModel();

    const zero = panel(model, ix(model, 'l.zero'));
    const zeroBars = zero.container.querySelectorAll('[data-role=orrery-bar]');
    expect(zeroBars.length).toBe(1);
    expect(zeroBars[0].getAttribute('data-measured')).toBeNull();      // 1. a solid track
    const zeroText = zero.container.querySelector('[data-role=orrery-bars]')?.textContent ?? '';
    expect(zeroText).toContain('0%');                                  // 2. a number, not a dash
    expect(zeroText).toContain('all');
    expect(
      [...zero.container.querySelectorAll('[data-role=orrery-note]')].some((n) =>
        (n.textContent ?? '').includes('not the same as 0%'),
      ),
    ).toBe(false);                                                     // 3. no unmeasured warning
    cleanup();

    const none = panel(model, ix(model, 'l.none'));
    const noneBars = none.container.querySelectorAll('[data-role=orrery-bar]');
    expect(noneBars.length).toBe(1);
    expect(noneBars[0].getAttribute('data-measured')).toBe('false');    // 1. hatched track
    const noneText = none.container.querySelector('[data-role=orrery-bars]')?.textContent ?? '';
    expect(noneText).toContain('—');                              // 2. an em dash
    expect(noneText).not.toContain('0%');
    const warn = [...none.container.querySelectorAll('[data-role=orrery-note][data-tone=warn]')].map(
      (n) => n.textContent ?? '',
    );
    expect(warn.some((t) => t.includes('unmeasured, which is not the same as 0%'))).toBe(true);
  });

  it('marks a container reach as DERIVED rather than measured', () => {
    const model = honestyModel();
    const conv = ix(model, 'c.conv');
    expect(model.R[conv].reach).toBeNull();
    expect(model.R[conv].reachMean).not.toBeNull();

    const { container } = panel(model, conv);
    const bar = container.querySelector('[data-role=orrery-bar]');
    expect(bar?.getAttribute('data-measured')).toBeNull();
    expect(bar?.getAttribute('data-derived')).toBe('true');
    const text = container.querySelector('[data-role=orrery-panelbody]')?.textContent ?? '';
    expect(text).toContain('derived, not a measurement');
    expect(text).toContain('~25%'); // mean over the two MEASURED descendants (0 and 50), not over 3
  });

  it('says the reach section is absent rather than empty when the document has no evidence', () => {
    const graph = honestyGraph();
    delete graph.evidence;
    const noEvidence = buildOrreryModel(graph, 'none');
    const { container } = panel(noEvidence, ix(noEvidence, 'l.zero'));
    expect(container.querySelector('[data-role=orrery-bars]')).toBeNull();
    expect(container.querySelector('[data-role=orrery-panelbody]')?.textContent).not.toContain('Reach');
  });
});

describe('OrreryPanel — the Audit tab', () => {
  it('lists every audit group with its count, and activating an item selects and returns to Inspect', () => {
    const model = honestyModel();
    const { container, onSelect, onTab } = panel(model, -1, 'audit');

    const groups = container.querySelectorAll('[data-role=orrery-audit-group]');
    expect(groups.length).toBe(model.audit.length);
    expect(groups.length).toBeGreaterThan(0);
    const counts = [...container.querySelectorAll('[data-role=orrery-audit-count]')];
    expect(counts.length).toBe(model.audit.length);
    expect(counts.map((c) => c.textContent)).toEqual(model.audit.map((g) => String(g.items.length)));
    // A zero count is a measured zero and says so with its own tone, never by vanishing.
    const zeros = model.audit.filter((g) => g.items.length === 0).length;
    expect(container.querySelectorAll('[data-role=orrery-audit-count][data-tone=zero]').length).toBe(zeros);

    const item = container.querySelector('[data-role=orrery-audit-item]');
    expect(item).not.toBeNull();
    fireEvent.click(item as Element);
    expect(onTab).toHaveBeenCalledWith('inspect');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(typeof onSelect.mock.calls[0][0]).toBe('number');
  });
});

describe('OrreryPanel — the staged documents', () => {
  it.skipIf(!FIXTURES_AVAILABLE)('renders all three staged documents, selected and unselected', () => {
    for (const name of ['mage-arena-season', 'pof-exemplars', 'synthetic-scale'] as const) {
      const model = buildOrreryModel(loadGraph(name), name);
      for (const sel of [-1, 0, model.R.length - 2]) {
        const { container } = panel(model, sel);
        expect(container.querySelector('[data-role=orrery-panel]')).not.toBeNull();
        cleanup();
      }
      for (const tab of ['audit'] as const) {
        const { container } = panel(model, -1, tab);
        expect(container.querySelector('[data-role=orrery-panel-title]')?.textContent).toBe('Audit');
        cleanup();
      }
    }
  });
});

describe('the port carries no literals the themes own', () => {
  const DIR = path.resolve(process.cwd(), 'src', 'components', 'story', 'orrery');
  const FILES = [
    'OrreryChrome.tsx',
    'OrreryPanel.tsx',
    'LineDetailLayer.tsx',
    ...fs.readdirSync(path.join(DIR, 'panel')).map((f) => path.join('panel', f)),
  ];

  it('has no hex colour and no literal px font size in any file of package B2', () => {
    for (const rel of FILES) {
      const src = fs.readFileSync(path.join(DIR, rel), 'utf8');
      expect(src.match(/#[0-9a-fA-F]{6}\b/g), `hex colour in ${rel}`).toBeNull();
      // A font size is only ever a token: the owner's "the font is often too small" is fixed in the
      // theme's `--or-fs-*` scale, and a literal here would escape the lift.
      expect(src.match(/fontSize:\s*['"`]?\d/g), `literal font size in ${rel}`).toBeNull();
    }
  });
});
