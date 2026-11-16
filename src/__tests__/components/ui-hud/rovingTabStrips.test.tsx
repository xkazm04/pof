import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/components/modules/content/ui-hud/HudThemeEditor/useAnimationLoop', () => ({
  useAnimationLoop: () => 0,
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ sendPrompt: vi.fn(), execute: vi.fn(), isRunning: false }),
}));

import { HudThemeEditor } from '@/components/modules/content/ui-hud/HudThemeEditor';
import { InventoryGridDesigner } from '@/components/modules/content/ui-hud/InventoryGridDesigner';
import { useHudDesignStore } from '@/stores/hudDesignStore';
import { useProjectStore } from '@/stores/projectStore';

beforeEach(() => {
  localStorage.clear();
  useHudDesignStore.setState({ byProject: {} });
  useProjectStore.setState({ projectPath: 'C:/P1', projectName: 'PoF', ueVersion: '5.8.0' });
});
afterEach(() => cleanup());

function walk() {
  const tabs = screen.getAllByRole('tab') as HTMLElement[];
  expect(tabs.length).toBeGreaterThan(2);
  tabs[0].focus();
  fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
  expect(document.activeElement).toBe(tabs[1]);
  fireEvent.keyDown(tabs[1], { key: 'End' });
  expect(document.activeElement).toBe(tabs[tabs.length - 1]);
  fireEvent.keyDown(tabs[tabs.length - 1], { key: 'ArrowRight' });
  expect(document.activeElement).toBe(tabs[0]);
  fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
  expect(document.activeElement).toBe(tabs[tabs.length - 1]);
  fireEvent.keyDown(tabs[tabs.length - 1], { key: 'Home' });
  expect(document.activeElement).toBe(tabs[0]);
}

describe('roving tab strips share one keyboard rule', () => {
  it('HUD theme editor tablist moves focus', () => {
    render(<HudThemeEditor />);
    walk();
  });
  it('Inventory designer tablist moves focus', () => {
    render(<InventoryGridDesigner onGenerate={() => {}} isGenerating={false} />);
    walk();
  });
});
