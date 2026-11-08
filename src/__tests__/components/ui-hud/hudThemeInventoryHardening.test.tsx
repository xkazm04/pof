import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

// The editor's preview runs a rAF clock; a frozen clock keeps renders deterministic.
vi.mock('@/components/modules/content/ui-hud/HudThemeEditor/useAnimationLoop', () => ({
  useAnimationLoop: () => 0,
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ sendPrompt: vi.fn(), execute: vi.fn(), isRunning: false }),
}));

import { HudThemeEditor } from '@/components/modules/content/ui-hud/HudThemeEditor';
import { useHudDesignStore } from '@/stores/hudDesignStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';

/**
 * scan-sweep night 2026-11-08 (hud-theme-and-inventory, --optimize): one block per
 * hardening fix, each written red first.
 */

beforeEach(() => {
  localStorage.clear();
  useHudDesignStore.setState({ byProject: {} });
  useProjectStore.setState({ projectPath: 'C:/P1', projectName: 'PoF', ueVersion: '5.8.0' });
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const copyButton = () => screen.getByTitle('Copy to clipboard');

describe('HUD theme Copy goes through the shared copyToClipboard', () => {
  it('a rejected clipboard write says so instead of throwing', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<HudThemeEditor />);
    await act(async () => { fireEvent.click(copyButton()); });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(copyButton().textContent).toContain('Copy failed');
  });

  it('a successful write shows Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<HudThemeEditor />);
    await act(async () => { fireEvent.click(copyButton()); });
    expect(copyButton().textContent).toContain('Copied');
  });
});

describe('HUD theme .h download goes through the shared downloadBlob', () => {
  it('does not revoke the blob URL in the same tick as the click', () => {
    vi.useFakeTimers();
    const saved = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    try {
      const revoke = vi.fn();
      URL.createObjectURL = () => 'blob:hud';
      URL.revokeObjectURL = revoke;
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      render(<HudThemeEditor />);
      fireEvent.click(screen.getByTitle('Download .h file'));
      expect(revoke).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(revoke).toHaveBeenCalledWith('blob:hud');
    } finally {
      URL.createObjectURL = saved.create;
      URL.revokeObjectURL = saved.revoke;
      vi.useRealTimers();
    }
  });
});

describe('HUD theme slider readouts print the precision the .h export writes', () => {
  function readout(section: string, label: string) {
    fireEvent.click(screen.getByRole('tab', { name: section }));
    const el = screen.getByText(label);
    const row = el.parentElement!.parentElement!;
    return { input: row.querySelector('input[type="range"]') as HTMLInputElement, shown: () => el.nextElementSibling!.textContent };
  }

  it('FadeInDuration 0.25 reads 0.25s, matching "FadeInDuration = 0.25f"', () => {
    render(<HudThemeEditor />);
    const r = readout('Enemy HP Bar', 'FadeInDuration');
    fireEvent.change(r.input, { target: { value: '0.25' } });
    expect(screen.getByText(/float FadeInDuration = 0\.25f;/)).toBeTruthy();
    expect(r.shown()).toBe('0.25s');
  });

  it('a percent-scaled row and a 1-decimal row keep their readouts', () => {
    render(<HudThemeEditor />);
    expect(readout('Health & Mana', 'LowHealthThreshold').shown()).toBe('25%');
    expect(readout('Enemy HP Bar', 'FadeOutDelay').shown()).toBe('3.0s');
  });
});

describe('preview damage numbers live their full DamageLifetime across the loop wrap', () => {
  it('the 6.2s heal at DamageLifetime 3.0 is still alive 2.3s later (0.5s into the next loop)', async () => {
    const { getCombatEvents } = await import('@/components/modules/content/ui-hud/HudThemeEditor/helpers');
    const { DEFAULT_THEME, CYCLE_DURATION } = await import('@/components/modules/content/ui-hud/HudThemeEditor/constants');
    const theme = { ...DEFAULT_THEME, damageLifetime: 3.0 };
    const t = CYCLE_DURATION + 0.5;
    const heal = getCombatEvents(t, theme).damageEvents.find((e) => e.amount === 350);
    expect(heal).toBeTruthy();
    expect(heal!.age).toBeCloseTo(2.3, 6);
  });

  it('an event keeps one id for its whole life, even after an earlier one expires', async () => {
    const { getCombatEvents } = await import('@/components/modules/content/ui-hud/HudThemeEditor/helpers');
    const { DEFAULT_THEME } = await import('@/components/modules/content/ui-hud/HudThemeEditor/constants');
    const fireId = (t: number) => getCombatEvents(t, DEFAULT_THEME).damageEvents.find((e) => e.amount === 892)!.id;
    // 1.3s: Physical (0.5s) still alive; 1.6s: it has expired (lifetime 1.0).
    expect(fireId(1.6)).toBe(fireId(1.3));
  });
});

describe('HUD theme colour picker keeps the colour alpha', () => {
  it('picking a new hue on a 0.5-alpha HealthBarColor keeps A = 0.50', async () => {
    const { DEFAULT_THEME } = await import('@/components/modules/content/ui-hud/HudThemeEditor/constants');
    useHudDesignStore.getState().setThemeDraft('C:/P1', { ...DEFAULT_THEME, healthyColor: { r: 0.1, g: 0.8, b: 0.1, a: 0.5 } });
    render(<HudThemeEditor />);
    const swatch = screen.getByText('Healthy Color').parentElement!.querySelector('input[type="color"]') as HTMLInputElement;
    // eslint-disable-next-line no-restricted-syntax -- <input type="color"> only accepts a #rrggbb value
    fireEvent.change(swatch, { target: { value: '#ff0000' } });
    expect(screen.getByText(/FLinearColor HealthBarColor = FLinearColor\(1\.00f, 0\.00f, 0\.00f, 0\.50f\);/)).toBeTruthy();
  });
});

describe('Inventory designer prints a real multiplication sign', () => {
  it('the grid summary and the dimension row read cols×rows, no mojibake', async () => {
    const { InventoryGridDesigner } = await import('@/components/modules/content/ui-hud/InventoryGridDesigner');
    const { container } = render(<InventoryGridDesigner onGenerate={vi.fn()} isGenerating={false} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Ă/); // 'Ă' — UTF-8 '×' (C3 97) decoded as CP1250
    expect(screen.getByText(/GRID:/).textContent).toMatch(/GRID:\s*\d+×\d+ \(\d+\)/);
    expect(text.split('×').length - 1).toBe(2);
  });
});

// Minimal accessible-name read: aria-label, aria-labelledby, a wrapping <label>, or (buttons) own text.
function accessibleName(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  const by = el.getAttribute('aria-labelledby');
  if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
  const wrap = el.closest('label');
  if (wrap?.textContent?.trim()) return wrap.textContent.trim();
  return el.tagName === 'BUTTON' ? (el.textContent ?? '').trim() : '';
}
const unnamed = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('button, input, textarea, select'))
    .filter((el) => !accessibleName(el));

describe('every HUD designer control has an accessible name', () => {
  it('Inventory designer: +/- steppers and the stack-limit field are named', async () => {
    const { InventoryGridDesigner } = await import('@/components/modules/content/ui-hud/InventoryGridDesigner');
    const { container } = render(<InventoryGridDesigner onGenerate={vi.fn()} isGenerating={false} />);
    expect(screen.queryByRole('checkbox')).toBeTruthy();
    if (!(screen.getByRole('checkbox') as HTMLInputElement).checked) fireEvent.click(screen.getByRole('checkbox'));
    expect(unnamed(container).map((el) => el.outerHTML.slice(0, 60))).toEqual([]);
    expect(screen.getByRole('button', { name: 'Increase Columns' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Stack limit' })).toBeTruthy();
  });

  it('HUD theme editor: every colour swatch is named by its row label', () => {
    const { container } = render(<HudThemeEditor />);
    for (const tab of ['Health & Mana', 'Damage Numbers', 'Enemy HP Bar']) {
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      expect(unnamed(container).map((el) => el.outerHTML.slice(0, 60))).toEqual([]);
    }
    fireEvent.click(screen.getByRole('tab', { name: 'Health & Mana' }));
    expect(screen.getByLabelText('Healthy Color')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause preview' })).toBeTruthy();
  });
});

describe('Inventory designer toggles expose their on/off state', () => {
  async function openSection(name: string) {
    const { InventoryGridDesigner } = await import('@/components/modules/content/ui-hud/InventoryGridDesigner');
    const { DEFAULT_CONFIG } = await import('@/lib/prompts/inventory');
    render(<InventoryGridDesigner onGenerate={vi.fn()} isGenerating={false} />);
    fireEvent.click(screen.getByRole('tab', { name }));
    return { panel: document.querySelector('[role="tabpanel"]') as HTMLElement, cfg: DEFAULT_CONFIG };
  }
  const pressed = (panel: HTMLElement) =>
    Array.from(panel.querySelectorAll('button')).map((b) => b.getAttribute('aria-pressed'));

  it('slot types: one aria-pressed per type, matching enabled, and it flips on click', async () => {
    const { panel, cfg } = await openSection('Types');
    expect(pressed(panel)).toEqual(cfg.slotTypes.map((s) => String(s.enabled)));
    const first = screen.getByRole('button', { name: cfg.slotTypes[0].label });
    fireEvent.click(first);
    expect(first.getAttribute('aria-pressed')).toBe(String(!cfg.slotTypes[0].enabled));
  });

  it('equipment slots: named by the full slot label, state in aria-pressed', async () => {
    const { panel, cfg } = await openSection('Equip');
    const slots = cfg.equipmentSlots;
    expect(pressed(panel)).toEqual(slots.map((s) => String(s.enabled)));
    for (const s of slots) expect(screen.getByRole('button', { name: s.label })).toBeTruthy();
  });

  it('interaction modes: aria-pressed matches the enabled set', async () => {
    const { panel, cfg } = await openSection('Inputs');
    const { ALL_INTERACTIONS } = await import('@/lib/prompts/inventory');
    expect(pressed(panel)).toEqual(ALL_INTERACTIONS.map((i) => String(cfg.interactions.includes(i.id))));
  });
});

describe('Equipment slot stubs are distinguishable on screen', () => {
  it('every equipment position renders a distinct visible stub, in both previews', async () => {
    const { InventoryGridDesigner } = await import('@/components/modules/content/ui-hud/InventoryGridDesigner');
    const { DEFAULT_CONFIG } = await import('@/lib/prompts/inventory');
    const allOn = { ...DEFAULT_CONFIG, equipmentSlots: DEFAULT_CONFIG.equipmentSlots.map((s) => ({ ...s, enabled: true })) };
    useHudDesignStore.getState().setInventoryDraft('C:/P1', allOn);
    render(<InventoryGridDesigner onGenerate={vi.fn()} isGenerating={false} />);
    // Grid tab: the silhouette's 24px stubs (title = full label).
    const gridStubs = allOn.equipmentSlots.map((s) => document.querySelector(`[title="${s.label}"]`)?.textContent?.trim());
    expect(new Set(gridStubs).size).toBe(allOn.equipmentSlots.length);
    fireEvent.click(screen.getByRole('tab', { name: 'Equip' }));
    const equipStubs = allOn.equipmentSlots.map((s) =>
      screen.getByRole('button', { name: s.label }).querySelector('span')!.textContent!.trim());
    expect(new Set(equipStubs).size).toBe(allOn.equipmentSlots.length);
  });
});

describe('FadeTimeline fills use the canonical OPACITY_* scale', () => {
  it('no raw two-digit alpha suffix on a colour token', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.resolve('src/components/modules/content/ui-hud/HudThemeEditor/FadeTimeline.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const raw = src.match(/\$\{[A-Z_]+\}[0-9a-fA-F]{2}`/g) ?? [];
    expect(raw).toEqual([]);
    expect(src).toMatch(/\$\{[A-Z_]+\}\$\{OPACITY_\d+\}/);
  });
});
