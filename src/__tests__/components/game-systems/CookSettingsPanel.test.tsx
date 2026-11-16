import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DEFAULT_COOK_SETTINGS, type CookSettings } from '@/lib/packaging/build-profiles';
import { CookSettingsPanel } from '@/components/modules/game-systems/CookSettingsPanel';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

/** The panel is controlled: hold its settings the way ProfileEditor does. */
function Harness({ onSettings }: { onSettings: (s: CookSettings) => void }) {
  const [settings, setSettings] = useState<CookSettings>({ ...DEFAULT_COOK_SETTINGS, mapsToInclude: [], pluginsToDisable: [] });
  return (
    <CookSettingsPanel
      settings={settings}
      onChange={(s) => { setSettings(s); onSettings(s); }}
    />
  );
}

function textareas(): HTMLTextAreaElement[] {
  return Array.from(document.querySelectorAll('textarea'));
}

describe('CookSettingsPanel field labels', () => {
  it('associates each visible field label with its control', () => {
    render(<CookSettingsPanel settings={{ ...DEFAULT_COOK_SETTINGS }} onChange={() => {}} />);
    const [maps, plugins] = textareas();
    expect(screen.getByLabelText('Maps to include')).toBe(maps);
    expect(screen.getByLabelText('Plugins to disable')).toBe(plugins);
    expect(screen.getByLabelText('Budget (MB, 0 = unlimited)')).toBe(document.querySelector('input[type="number"]'));
  });
});

describe('CookSettingsPanel list fields', () => {
  it('keeps the newline you type so a second map can be entered', () => {
    let last: CookSettings | null = null;
    render(<Harness onSettings={(s) => { last = s; }} />);
    const [maps] = textareas();

    fireEvent.change(maps, { target: { value: '/Game/Maps/A\n' } });
    // The Enter must survive the round-trip through the parent's settings.
    expect(maps.value).toBe('/Game/Maps/A\n');
    expect(last!.mapsToInclude).toEqual(['/Game/Maps/A']);

    fireEvent.change(maps, { target: { value: '/Game/Maps/A\n/Game/Maps/B' } });
    expect(maps.value).toBe('/Game/Maps/A\n/Game/Maps/B');
    expect(last!.mapsToInclude).toEqual(['/Game/Maps/A', '/Game/Maps/B']);
  });

  it('keeps the newline in the plugins list too', () => {
    let last: CookSettings | null = null;
    render(<Harness onSettings={(s) => { last = s; }} />);
    const [, plugins] = textareas();

    fireEvent.change(plugins, { target: { value: 'OnlineSubsystemSteam\n' } });
    expect(plugins.value).toBe('OnlineSubsystemSteam\n');
    expect(last!.pluginsToDisable).toEqual(['OnlineSubsystemSteam']);
  });

  it('follows a settings change from outside (another profile loaded)', () => {
    const { rerender } = render(<CookSettingsPanel settings={{ ...DEFAULT_COOK_SETTINGS, mapsToInclude: ['/Game/X'] }} onChange={() => {}} />);
    expect(textareas()[0].value).toBe('/Game/X');
    rerender(<CookSettingsPanel settings={{ ...DEFAULT_COOK_SETTINGS, mapsToInclude: ['/Game/Y', '/Game/Z'] }} onChange={() => {}} />);
    expect(textareas()[0].value).toBe('/Game/Y\n/Game/Z');
  });
});

describe('CookSettingsPanel switches', () => {
  it('draws a keyboard focus indicator on every switch track', () => {
    render(<CookSettingsPanel settings={{ ...DEFAULT_COOK_SETTINGS }} onChange={() => {}} />);
    const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    expect(boxes.length).toBeGreaterThanOrEqual(7);
    const withRing = boxes.filter((b) => {
      const track = b.nextElementSibling;
      return b.classList.contains('peer') && (track?.className ?? '').includes('peer-focus-visible:ring');
    });
    expect(withRing.length).toBe(boxes.length);
  });
});
