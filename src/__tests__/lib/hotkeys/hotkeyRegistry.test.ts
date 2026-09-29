/**
 * The keyboard door (scan-sweep --challenge, shared-utility-hooks/A): one
 * owner per chord, a LIFO Escape stack, loud same-scope collisions.
 * Pure registry cases — each test builds its own registry.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { createHotkeyRegistry, type HotkeyRegistry } from '@/lib/hotkeys/hotkeyRegistry';

let reg: HotkeyRegistry | null = null;
afterEach(() => { reg?.reset(); reg = null; vi.restoreAllMocks(); });

function press(init: KeyboardEventInit, target: EventTarget = window): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

describe('hotkeyRegistry — one owner per chord', () => {
  it('case 1: the innermost active scope is the ONE owner of mod+k', () => {
    reg = createHotkeyRegistry();
    const globalOpen = vi.fn();
    const spellOpen = vi.fn();
    reg.register('mod+k', globalOpen, { scope: 'shell' });
    reg.register('mod+k', spellOpen, { scope: 'module:arpg-ability' });

    const e = press({ key: 'k', ctrlKey: true });
    expect(spellOpen).toHaveBeenCalledTimes(1);
    expect(globalOpen).toHaveBeenCalledTimes(0);
    expect(e.defaultPrevented).toBe(true);

    // mod = Ctrl OR Meta; an unhandled key is left alone (no preventDefault).
    press({ key: 'k', metaKey: true });
    expect(spellOpen).toHaveBeenCalledTimes(2);
    expect(press({ key: 'x', ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it('case 6: two owners of one chord in the SAME scope are reported, warned once, last wins', () => {
    reg = createHotkeyRegistry();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const a = vi.fn();
    const b = vi.fn();
    reg.register('mod+k', a, { scope: 'shell', id: 'a' });
    reg.register('mod+k', b, { scope: 'shell', id: 'b' });

    expect(reg.collisions()).toEqual([{ chord: 'mod+k', scope: 'shell', owners: ['a', 'b'] }]);
    expect(warn).toHaveBeenCalledTimes(1);
    press({ key: 'k', ctrlKey: true });
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it('unregister releases the chord and the window listener', () => {
    reg = createHotkeyRegistry();
    const h = vi.fn();
    const off = reg.register('ctrl+b', h, { allowInInput: true });
    off();
    off();
    press({ key: 'b', ctrlKey: true });
    expect(h).not.toHaveBeenCalled();
    expect(reg.collisions()).toEqual([]);
  });

  it('a chord without allowInInput is not fired from a textarea; one with it is', () => {
    reg = createHotkeyRegistry();
    const quiet = vi.fn();
    const loud = vi.fn();
    reg.register('ctrl+1', quiet);
    reg.register('ctrl+2', loud, { allowInInput: true });
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    press({ key: '1', ctrlKey: true }, ta);
    press({ key: '2', ctrlKey: true }, ta);
    ta.remove();
    expect(quiet).not.toHaveBeenCalled();
    expect(loud).toHaveBeenCalledTimes(1);
  });
});

describe('hotkeyRegistry — Escape is a LIFO layer stack', () => {
  it('case 3: one Escape closes only the top layer; the next Escape the one under it', () => {
    reg = createHotkeyRegistry();
    const closeSidebar = vi.fn();
    const closeSearch = vi.fn();
    reg.pushLayer('sidebar-drawer', closeSidebar);
    reg.pushLayer('global-search', closeSearch);

    press({ key: 'Escape' });
    expect(closeSearch).toHaveBeenCalledTimes(1);
    expect(closeSidebar).not.toHaveBeenCalled();

    press({ key: 'Escape' });
    expect(closeSidebar).toHaveBeenCalledTimes(1);
    expect(closeSearch).toHaveBeenCalledTimes(1);
    expect(reg.layers()).toEqual([]);
  });

  it('popping a layer out of order keeps the rest of the stack', () => {
    reg = createHotkeyRegistry();
    const a = vi.fn();
    const b = vi.fn();
    reg.pushLayer('a', a);
    const popB = reg.pushLayer('b', b);
    reg.pushLayer('c', vi.fn());
    popB();
    expect(reg.layers()).toEqual(['a', 'c']);
  });
});

describe('hotkeyRegistry — exclusive capture', () => {
  it('captureNext takes the next key once, before any chord owner, then lets go', () => {
    reg = createHotkeyRegistry();
    const chord = vi.fn();
    const cap = vi.fn();
    const bubbled = vi.fn();
    window.addEventListener('keydown', bubbled);
    reg.register('mod+k', chord, { allowInInput: true });
    reg.captureNext(cap);

    press({ key: 'k', ctrlKey: true });
    expect(cap).toHaveBeenCalledTimes(1);
    expect(chord).not.toHaveBeenCalled();
    expect(bubbled).not.toHaveBeenCalled();

    press({ key: 'k', ctrlKey: true });
    expect(cap).toHaveBeenCalledTimes(1);
    expect(chord).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', bubbled);
  });

  it('a released capture never fires', () => {
    reg = createHotkeyRegistry();
    const cap = vi.fn();
    const release = reg.captureNext(cap);
    release();
    press({ key: 'g' });
    expect(cap).not.toHaveBeenCalled();
  });
});
