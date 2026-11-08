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
