import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ok, err } from '@/types/result';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/components/modules/shared/ReviewableModuleView', () => ({ ReviewableModuleView: () => null }));
vi.mock('@/components/modules/visual-gen/material-lab/PBREditor', () => ({ PBREditor: () => null }));
vi.mock('@/components/modules/visual-gen/material-lab/AdvancedTexturePanel', () => ({ AdvancedTexturePanel: () => null }));
vi.mock('@/components/modules/visual-gen/material-lab/UE5ExportPanel', () => ({ UE5ExportPanel: () => null }));
vi.mock('@/components/blender-mcp/BlenderConnectionBar', () => ({ BlenderConnectionBar: () => null }));
vi.mock('@/components/blender-mcp/ViewportPreview', () => ({ ViewportPreview: () => null }));

import { EditorTab } from '@/components/modules/visual-gen/material-lab/MaterialLabView';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

beforeEach(() => {
  useMaterialStore.getState().reset();
  useBlenderMCPStore.setState((s) => ({ connection: { ...s.connection, connected: true } }));
});
afterEach(() => cleanup());

describe('EditorTab Send to Blender announcements', () => {
  it('holds the success report inside a pre-mounted role=status region', async () => {
    useMaterialStore.setState({
      sendToBlender: async () => ok({ name: 'M', plan: { sent: ['base colour'], notSent: [], textures: {} } }),
    } as never);
    render(<EditorTab />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.querySelector('[data-testid="blender-send-report"]')).toBeNull();
    fireEvent.click(screen.getByText('Send to Blender'));
    await waitFor(() => {
      expect(screen.getByRole('status').querySelector('[data-testid="blender-send-report"]')).not.toBeNull();
    });
  });

  it('marks the send error role=alert', async () => {
    useMaterialStore.setState({ sendToBlender: async () => err('Blender unreachable') } as never);
    render(<EditorTab />);
    fireEvent.click(screen.getByText('Send to Blender'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Blender unreachable');
    });
  });
});
