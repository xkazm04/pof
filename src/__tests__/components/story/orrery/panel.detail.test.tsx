/**
 * The fourth level — the nested layer the owner asked for on line click.
 *
 * What these tests hold:
 *   - it answers situation, predecessor, impact, IN THAT ORDER (the owner's three words);
 *   - it opens from a line click and descends INSIDE the panel, never over the wheel;
 *   - it keeps the three reach states apart (measured 0% / derived / unmeasured);
 *   - it names a write nothing reads as a decoration, which is the fact that makes one visible;
 *   - Escape and the Close button both climb back out, and focus returns where it came from.
 */

import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { OrreryPanel } from '@/components/story/orrery/OrreryPanel';
import { buildLineDetail } from '@/lib/story/orrery';
import type { LineDetail, OrreryModel } from '@/lib/story/orrery';
import { honestyModel, ix } from '@/__tests__/components/story/orrery/panelFixture';

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

/** The composition `OrreryView` will own: the parent holds the open detail, the panel renders it. */
function Controlled({ model, i }: { model: OrreryModel; i: number }) {
  const [detail, setDetail] = useState<LineDetail | null>(null);
  const [selected, setSelected] = useState(i);
  return (
    <>
      <button type="button" data-testid="origin" onClick={() => setDetail(buildLineDetail(model, selected))}>
        open
      </button>
      <OrreryPanel
        model={model}
        selected={selected}
        detail={detail}
        tab="inspect"
        onTab={vi.fn()}
        onSelect={setSelected}
        onCloseDetail={() => setDetail(null)}
        onOpenDetail={setDetail}
        focus={model.root}
      />
    </>
  );
}

/** The composition that exists today: nobody wired the layer, so the panel owns it. */
function Uncontrolled({ model, i }: { model: OrreryModel; i: number }) {
  const [selected, setSelected] = useState(i);
  return (
    <OrreryPanel
      model={model}
      selected={selected}
      detail={null}
      tab="inspect"
      onTab={vi.fn()}
      onSelect={setSelected}
      onCloseDetail={vi.fn()}
      focus={model.root}
    />
  );
}

const headsOf = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-role=orrery-legend-head]')].map((h) => h.textContent ?? '');

describe('LineDetailLayer — the owner’s three questions', () => {
  it('answers situation, then predecessor, then impact', () => {
    const model = honestyModel();
    const { container, getByTestId } = render(<Controlled model={model} i={ix(model, 'l.none')} />);
    fireEvent.click(getByTestId('origin'));

    const card = container.querySelector('[data-role=orrery-detail]');
    expect(card).not.toBeNull();
    expect(card?.getAttribute('role')).toBe('group');
    expect(card?.getAttribute('aria-label')).toContain('A line nobody measured');

    expect(headsOf(card as Element)).toEqual([
      'Line detail',
      'Situation',
      'What led here',
      'What it changes',
    ]);
  });

  it('is a nested card inside the panel body, not a dialog over the wheel', () => {
    const model = honestyModel();
    const { container, getByTestId } = render(<Controlled model={model} i={ix(model, 'l.none')} />);
    fireEvent.click(getByTestId('origin'));
    const card = container.querySelector('[data-role=orrery-detail]') as Element;
    expect(card.closest('[data-role=orrery-panelbody]')).not.toBeNull();
    // A dialog role / aria-modal would take the wheel away from the reader.
    expect(card.getAttribute('aria-modal')).toBeNull();
    expect(card.getAttribute('role')).not.toBe('dialog');
    // The metadata the owner said to keep is still below it.
    const body = container.querySelector('[data-role=orrery-panelbody]')?.textContent ?? '';
    expect(body).toContain('Connections');
  });

  it('walks the containment ladder down to the line you are standing on', () => {
    const model = honestyModel();
    const { container, getByTestId } = render(<Controlled model={model} i={ix(model, 'l.none')} />);
    fireEvent.click(getByTestId('origin'));
    const card = container.querySelector('[data-role=orrery-detail]') as Element;
    const ladder = card.querySelector('[data-role=orrery-rels]') as Element;
    const rows = [...ladder.querySelectorAll('[data-role=orrery-rel]')];

    expect(rows.length).toBe(3); // dataset root > conversation > this line
    expect(rows[1].textContent).toContain('The Ferryman');
    // Every row but the last is a way out; the last is where you are, so it is not a button.
    expect(rows[0].tagName).toBe('BUTTON');
    expect(rows[1].tagName).toBe('BUTTON');
    expect(rows[2].tagName).toBe('DIV');
    expect(rows[2].getAttribute('aria-current')).toBe('true');
    expect(rows[2].textContent).toContain('you are here');
    // The position is the model's own sibling order, read back rather than assumed.
    const conv = model.R[ix(model, 'c.conv')];
    const at = conv.kids.indexOf(ix(model, 'l.none')) + 1;
    expect(card.textContent).toContain(`${at} of ${conv.kids.length} in The Ferryman`);
  });

  it('names a write nothing reads as a decoration, and an ending-shaping one as read', () => {
    const model = honestyModel();
    const { container, getByTestId } = render(<Controlled model={model} i={ix(model, 'l.none')} />);
    fireEvent.click(getByTestId('origin'));
    const card = container.querySelector('[data-role=orrery-detail]') as Element;

    const chips = [...card.querySelectorAll('[data-role=orrery-chipw]')].map((c) => c.textContent ?? '');
    expect(chips.some((t) => t.includes('mood') && t.includes('+'))).toBe(true);
    expect(chips.some((t) => t.includes('fate') && t.includes('='))).toBe(true);
    // The sign is an attribute, not a colour: `add` is a gain, `set` is not signed at all.
    const mood = [...card.querySelectorAll('[data-role=orrery-chipw]')].find((c) =>
      (c.textContent ?? '').startsWith('mood'),
    );
    const fate = [...card.querySelectorAll('[data-role=orrery-chipw]')].find((c) =>
      (c.textContent ?? '').startsWith('fate'),
    );
    expect(mood?.getAttribute('data-sign')).toBe('pos');
    expect(fate?.getAttribute('data-sign')).toBeNull();

    const verdicts = [...card.querySelectorAll('[data-role=orrery-chip]')].map((c) => c.textContent ?? '');
    expect(verdicts.some((t) => t.includes('nothing reads this'))).toBe(true);
    expect(verdicts.some((t) => t.includes('an ending reads this'))).toBe(true);
    // And the decoration verdict is not hue-only: it carries its own words and a warn tone.
    const decoration = [...card.querySelectorAll('[data-role=orrery-chip]')].find((c) =>
      (c.textContent ?? '').includes('nothing reads this'),
    );
    expect(decoration?.getAttribute('data-tone')).toBe('warn');
  });

  it('says plainly when nothing leads to a line, instead of showing an empty list', () => {
    const model = honestyModel();
    const { container, getByTestId } = render(<Controlled model={model} i={ix(model, 'l.ghost')} />);
    fireEvent.click(getByTestId('origin'));
    const card = container.querySelector('[data-role=orrery-detail]') as Element;
    const warn = [...card.querySelectorAll('[data-role=orrery-note][data-tone=warn]')].map((n) => n.textContent ?? '');
    expect(warn.some((t) => t.includes('No traversal edge arrives at this line'))).toBe(true);
    expect(card.textContent).toContain('It is entered by being inside The Ferryman');
    expect(card.textContent).toContain('writes nothing');
  });
});

describe('LineDetailLayer — unmeasured is not zero, here too', () => {
  const open = (model: OrreryModel, id: string) => {
    const r = render(<Controlled model={model} i={ix(model, id)} />);
    fireEvent.click(r.getByTestId('origin'));
    return r.container.querySelector('[data-role=orrery-detail]') as Element;
  };

  it('draws a measured 0% and leaves an unmeasured row hatched and dashed', () => {
    const model = honestyModel();

    const zero = open(model, 'l.zero');
    const zeroBar = zero.querySelector('[data-role=orrery-bar]');
    expect(zeroBar?.getAttribute('data-measured')).toBeNull();
    expect(zero.querySelector('[data-role=orrery-bars]')?.textContent).toContain('0%');
    expect(zero.textContent).not.toContain('not the same as 0%');
    cleanup();

    const none = open(model, 'l.none');
    const noneBar = none.querySelector('[data-role=orrery-bar]');
    expect(noneBar?.getAttribute('data-measured')).toBe('false');
    expect(none.querySelector('[data-role=orrery-bars]')?.textContent).toContain('—');
    expect(none.querySelector('[data-role=orrery-bars]')?.textContent).not.toContain('0%');
    expect(none.textContent).toContain('unmeasured, which is not the same as 0%');
  });
});

describe('LineDetailLayer — opening and climbing back out', () => {
  it('opens on a line click in the script, with no wiring from the parent', () => {
    const model = honestyModel();
    const { container } = render(<Uncontrolled model={model} i={ix(model, 'c.conv')} />);
    expect(container.querySelector('[data-role=orrery-detail]')).toBeNull();

    const rows = [...container.querySelectorAll('[data-role=orrery-script-row]')];
    expect(rows.length).toBe(4);
    const oath = rows.find((r) => (r.textContent ?? '').includes('An oath, of a kind'));
    expect(oath).not.toBeUndefined();
    fireEvent.click(oath as Element);

    const card = container.querySelector('[data-role=orrery-detail]');
    expect(card).not.toBeNull();
    expect(card?.getAttribute('aria-label')).toContain('An oath, of a kind');
  });

  it('takes focus when it opens, and gives it back on Escape', () => {
    const model = honestyModel();
    const { container, getByTestId } = render(<Controlled model={model} i={ix(model, 'l.none')} />);
    const origin = getByTestId('origin');
    origin.focus();
    fireEvent.click(origin);

    const card = container.querySelector('[data-role=orrery-detail]') as HTMLElement;
    expect(document.activeElement).toBe(card);

    fireEvent.keyDown(card, { key: 'Escape' });
    expect(container.querySelector('[data-role=orrery-detail]')).toBeNull();
    expect(document.activeElement).toBe(origin);
  });

  it('closes on the real button too, and returns focus', () => {
    const model = honestyModel();
    const { container, getByTestId } = render(<Controlled model={model} i={ix(model, 'l.none')} />);
    const origin = getByTestId('origin');
    origin.focus();
    fireEvent.click(origin);

    const card = container.querySelector('[data-role=orrery-detail]') as HTMLElement;
    const close = [...card.querySelectorAll('[data-role=orrery-headerbtn]')].find((b) =>
      (b.textContent ?? '').includes('Close'),
    );
    expect(close).not.toBeUndefined();
    fireEvent.click(close as Element);
    expect(container.querySelector('[data-role=orrery-detail]')).toBeNull();
    expect(document.activeElement).toBe(origin);
  });

  it('does not leave the layer open on a line it no longer describes', () => {
    const model = honestyModel();
    const { container } = render(<Uncontrolled model={model} i={ix(model, 'c.conv')} />);
    const row = [...container.querySelectorAll('[data-role=orrery-script-row]')].find((r) =>
      (r.textContent ?? '').includes('An oath, of a kind'),
    ) as Element;
    fireEvent.click(row);
    expect(container.querySelector('[data-role=orrery-detail]')).not.toBeNull();

    // Walking to a neighbour from inside the layer closes it: it belonged to the other line.
    const card = container.querySelector('[data-role=orrery-detail]') as Element;
    const step = card.querySelectorAll('[data-role=orrery-rel]')[0] as HTMLElement;
    fireEvent.click(step);
    expect(container.querySelector('[data-role=orrery-detail]')).toBeNull();
  });
});
