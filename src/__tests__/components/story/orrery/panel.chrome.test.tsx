/**
 * The Orrery chrome: the topbar, the overlays that float over the wheel, and the search combobox.
 *
 * The role hooks asserted here are the ones the style contract resolves by `querySelector`, so a
 * renamed or missing hook is a contract failure and not a cosmetic one.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { COHORT_DIVERGENCE, OrreryChrome } from '@/components/story/orrery/OrreryChrome';
import { buildOrreryModel } from '@/lib/story/orrery';
import type { OrreryModel } from '@/lib/story/orrery';
import { honestyModel, ix } from '@/__tests__/components/story/orrery/panelFixture';
import { FIXTURES_AVAILABLE, loadGraph } from '@/__tests__/lib/story/orrery/_fixtures';

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

function chrome(model: OrreryModel, over: Partial<Parameters<typeof OrreryChrome>[0]> = {}) {
  const onSelect = vi.fn();
  const onFocus = vi.fn();
  const onToggle = vi.fn();
  const onLens = vi.fn();
  const r = render(
    <OrreryChrome
      model={model}
      focus={model.root}
      datasets={[{ key: 'fixture', label: 'Inspector Fixture' }]}
      activeDataset="fixture"
      onDataset={vi.fn()}
      lens={null}
      onLens={onLens}
      show={{ impact: true, paths: true, influence: true, flags: true }}
      onToggle={onToggle}
      onFocus={onFocus}
      onSelect={onSelect}
      {...over}
    />,
  );
  return { ...r, onSelect, onFocus, onToggle, onLens };
}

describe('OrreryChrome — the topbar', () => {
  it('emits every topbar role the contract resolves', () => {
    const { container } = chrome(honestyModel());
    expect(container.querySelector('[data-role=orrery-topbar]')?.tagName).toBe('HEADER');
    expect(container.querySelector('[data-role=orrery-brand]')?.textContent).toBe('ORRERY');
    expect(container.querySelector('[data-role=orrery-brand-sub]')).not.toBeNull();
    expect(container.querySelectorAll('[data-role=orrery-select]').length).toBe(2);
    expect(container.querySelector('[data-role=orrery-spacer]')).not.toBeNull();

    const search = container.querySelector('[data-role=orrery-search]') as HTMLInputElement;
    expect(search.getAttribute('role')).toBe('combobox');
    expect(search.getAttribute('aria-expanded')).toBe('false');
    expect(search.getAttribute('aria-controls')).toBe(
      container.querySelector('[data-role=orrery-results]')?.getAttribute('id'),
    );

    const btns = [...container.querySelectorAll('[data-role=orrery-headerbtn]')];
    expect(btns.length).toBe(5); // four layer toggles and the help button
    expect(btns.slice(0, 4).map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true', 'true']);
    // The influence toggle keeps its own rim when pressed; the theme reads it off the tone.
    expect(container.querySelector('[data-role=orrery-headerbtn][data-tone=influence]')).not.toBeNull();
    // The help button is the unpressed instance the contract row was measured on.
    expect(btns[4].getAttribute('aria-pressed')).toBeNull();
    expect(btns[4].textContent).toBe('?');
  });

  it('toggles a layer through the callback rather than owning the state', () => {
    const { container, onToggle } = chrome(honestyModel());
    fireEvent.click(container.querySelectorAll('[data-role=orrery-headerbtn]')[0]);
    expect(onToggle).toHaveBeenCalledWith('impact');
  });

  it('offers one lens option per cohort, and a divergence option only when there are two', () => {
    const model = honestyModel();
    const { container, onLens } = chrome(model);
    const lens = container.querySelectorAll('[data-role=orrery-select]')[1] as HTMLSelectElement;
    expect(lens.disabled).toBe(false);
    // One cohort: off + that cohort, and no divergence option to mislead with.
    expect([...lens.options].map((o) => o.value)).toEqual(['', 'all']);
    expect([...lens.options].map((o) => o.textContent)).toEqual([
      'Reach lens: off',
      'Reach: all (provisional)',
    ]);
    fireEvent.change(lens, { target: { value: 'all' } });
    expect(onLens).toHaveBeenCalledWith('all');
  });
});

describe('OrreryChrome — the overlays over the wheel', () => {
  it('renders breadcrumbs, honesty badges, the legend and the view tools', () => {
    const model = honestyModel();
    const { container } = chrome(model, { focus: ix(model, 'c.conv'), selected: ix(model, 'l.none') });

    const crumbs = container.querySelector('[data-role=orrery-crumbs]');
    expect(crumbs?.tagName).toBe('NAV');
    expect(container.querySelectorAll('[data-role=orrery-crumb]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-role=orrery-crumb-cur]')?.textContent).toBe('A line nobody measured');

    expect(container.querySelector('[data-role=orrery-legend]')?.tagName).toBe('DETAILS');
    expect(container.querySelectorAll('[data-role=orrery-legend-head]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-role=orrery-legend-swatch]').length).toBeGreaterThan(0);

    const tools = [...container.querySelectorAll('[data-role=orrery-tool]')];
    expect(tools.length).toBe(4);
    expect(tools[0].getAttribute('aria-label')).toBe('Up one level');

    expect(container.querySelector('[data-role=orrery-sr]')?.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelector('[data-role=orrery-sr]')?.textContent).toContain('A line nobody measured');
    // Unmeasured is said out loud, not implied by a missing number.
    expect(container.querySelector('[data-role=orrery-sr]')?.textContent).toContain('which is not zero');
  });

  it('states every honesty flag the document carries, and each one as words', () => {
    const { container } = chrome(honestyModel());
    const chips = [...container.querySelectorAll('[data-role=orrery-chip]')].map((c) => ({
      text: c.textContent ?? '',
      tone: c.getAttribute('data-tone'),
    }));
    // graphHash null, provisional, and no declared axis — all three are in the fixture.
    expect(chips.some((c) => c.text.includes('graphHash null') && c.tone === 'warn')).toBe(true);
    expect(chips.some((c) => c.text.includes('provisional') && c.tone === 'warn')).toBe(true);
    expect(chips.some((c) => c.text.includes('no time axis') && c.tone === null)).toBe(true);
    // The contract's `chip` row is the WARN variant: there must be one to resolve.
    expect(container.querySelector('[data-role=orrery-chip][data-tone=warn]')).not.toBeNull();
  });

  it('shows the lens in the badges and the legend once one is picked', () => {
    const { container } = chrome(honestyModel(), { lens: COHORT_DIVERGENCE });
    const chips = [...container.querySelectorAll('[data-role=orrery-chip]')].map((c) => c.textContent ?? '');
    expect(chips.some((t) => t.includes('lens: cohort divergence'))).toBe(true);
    expect(container.querySelector('[data-role=orrery-legend]')?.textContent).toContain(
      'hatched = no reach row: never measured, not zero',
    );
  });

  it('disables Up at the root with nothing selected, and climbs when there is somewhere to go', () => {
    const model = honestyModel();
    const atRoot = chrome(model);
    expect((atRoot.container.querySelectorAll('[data-role=orrery-tool]')[0] as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    const inside = chrome(model, { focus: ix(model, 'c.conv') });
    const up = inside.container.querySelectorAll('[data-role=orrery-tool]')[0] as HTMLButtonElement;
    expect(up.disabled).toBe(false);
    fireEvent.click(up);
    expect(inside.onFocus).toHaveBeenCalledWith(model.root);
  });
});

describe('OrreryChrome — search', () => {
  it('filters, moves with the arrow keys, jumps on Enter and closes on Escape', () => {
    const model = honestyModel();
    const { container, onSelect } = chrome(model);
    const input = container.querySelector('[data-role=orrery-search]') as HTMLInputElement;
    const results = container.querySelector('[data-role=orrery-results]') as HTMLElement;
    expect(results.getAttribute('data-open')).toBe('0');

    fireEvent.change(input, { target: { value: 'line' } });
    expect(results.getAttribute('data-open')).toBe('1');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const options = [...results.querySelectorAll('[data-role=orrery-result]')];
    expect(options.length).toBeGreaterThan(1);
    expect(options[0].getAttribute('role')).toBe('option');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[1].getAttribute('aria-selected')).toBe('false');
    // Each row says which node it is, not only its title.
    expect(options[0].querySelector('small')?.textContent).toContain('l.');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(
      [...results.querySelectorAll('[data-role=orrery-result]')].map((o) => o.getAttribute('aria-selected')),
    ).toEqual(['false', 'true']);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    const picked = onSelect.mock.calls[0][0] as number;
    expect(model.R[picked].title.toLowerCase()).toContain('line');
    // Jumping clears the field, so the popover does not hang over the wheel.
    expect((container.querySelector('[data-role=orrery-search]') as HTMLInputElement).value).toBe('');

    fireEvent.change(input, { target: { value: 'nothing matches this' } });
    expect(container.querySelector('[data-role=orrery-result]')).toBeNull();
    expect(container.querySelector('[data-role=orrery-results]')?.textContent).toContain('No node matches');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(container.querySelector('[data-role=orrery-results]')?.getAttribute('data-open')).toBe('0');
  });

  it('ranks an exact id above a title substring', () => {
    const model = honestyModel();
    const { container } = chrome(model);
    const input = container.querySelector('[data-role=orrery-search]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'l.none' } });
    const first = container.querySelector('[data-role=orrery-result] small')?.textContent ?? '';
    expect(first).toContain('l.none');
  });
});

describe('OrreryChrome — the staged documents', () => {
  it.skipIf(!FIXTURES_AVAILABLE)('renders pof-exemplars, which declares no axis and no reach', () => {
    const model = buildOrreryModel(loadGraph('pof-exemplars'), 'pof-exemplars');
    const { container } = chrome(model);
    const lens = container.querySelectorAll('[data-role=orrery-select]')[1] as HTMLSelectElement;
    // No cohorts: the lens is disabled and says why, instead of offering an empty tint.
    expect(model.cohorts.length).toBe(0);
    expect(lens.disabled).toBe(true);
    expect(lens.getAttribute('title')).toContain('carries no reach evidence');
    const chips = [...container.querySelectorAll('[data-role=orrery-chip]')].map((c) => c.textContent ?? '');
    expect(chips.some((t) => t.includes('no reach evidence in this file'))).toBe(true);
    expect(container.querySelector('[data-role=orrery-legend]')?.textContent).not.toContain('Reach lens');
  });

  it.skipIf(!FIXTURES_AVAILABLE)('renders mage-arena-season, which is provisional and unverified', () => {
    const model = buildOrreryModel(loadGraph('mage-arena-season'), 'mage-arena-season');
    const { container } = chrome(model);
    const chips = [...container.querySelectorAll('[data-role=orrery-chip]')].map((c) => c.textContent ?? '');
    expect(chips.some((t) => t.includes('graphHash null'))).toBe(true);
    expect(model.prov.provisional ? chips.some((t) => t.includes('provisional')) : true).toBe(true);
  });
});
