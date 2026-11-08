/**
 * One `creatingPresetId` tracked a per-card flag, but each card only disabled on
 * ITS OWN id: starting a second preset overwrote the id, so the first card lost
 * its spinner and the first completion cleared the second's.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

vi.mock('@/components/modules/shared/ReviewableModuleView', () => ({
  ReviewableModuleView: ({ extraTabs }: { extraTabs: ExtraTab[] }) => <div>{extraTabs[0].render({} as never)}</div>,
}));
vi.mock('@/components/blender-mcp/BlenderConnectionBar', () => ({ BlenderConnectionBar: () => null }));

import { AutoRigView } from '@/components/modules/visual-gen/auto-rig/AutoRigView';

beforeEach(() => {
  useBlenderMCPStore.setState((s) => ({ connection: { ...s.connection, connected: true } }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('execute')) return new Promise(() => {});
    return { ok: true, status: 200, json: async () => ({ success: true, data: { assets: [] } }) };
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Auto-Rig create in flight', () => {
  it('holds every Create button while one armature is being built', async () => {
    render(<AutoRigView />);
    const buttons = screen.getAllByRole('button', { name: /create in blender/i }) as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThan(1);
    fireEvent.click(buttons[0]);
    const after = screen.getAllByRole('button', { name: /creating|create in blender/i }) as HTMLButtonElement[];
    expect(after.every((b) => b.disabled)).toBe(true);
  });
});
