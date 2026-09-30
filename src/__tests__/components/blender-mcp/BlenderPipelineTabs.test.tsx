import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  LODGenerationTab,
  MeshOptimizationTab,
  FBXConversionTab,
} from '@/components/modules/visual-gen/blender-pipeline/BlenderPipelineView';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

function setConnected(connected: boolean) {
  useBlenderMCPStore.setState({
    host: '127.0.0.1',
    port: 9876,
    autoConnect: false,
    connection: { host: '127.0.0.1', port: 9876, connected },
    isConnecting: false,
    lastError: null,
    recentScreenshots: [],
    retryAttempt: 0,
    autoRetrying: false,
    autoConnectAttempted: false,
  });
}

afterEach(cleanup);
beforeEach(() => setConnected(true));

describe('Blender pipeline tabs compose from the shared MCP primitives', () => {
  it('LOD tab renders labeled fields and a single-radius card / button', () => {
    const { container } = render(<LODGenerationTab />);
    expect(screen.getByText('Object Name')).toBeTruthy();
    expect(screen.getByText(/LOD Ratios/)).toBeTruthy();

    // The card and the submit button share the canonical radius — no drift.
    const card = container.querySelector('.rounded-md.border');
    expect(card).toBeTruthy();
    expect(container.querySelector('.rounded-lg')).toBeNull();
    expect(screen.getByRole('button').classList.contains('rounded-md')).toBe(true);
  });

  it('Mesh Optimization tab renders its fields', () => {
    render(<MeshOptimizationTab />);
    expect(screen.getByText('Object Name')).toBeTruthy();
    expect(screen.getByText('Merge Distance')).toBeTruthy();
    expect(screen.getByText('Remove Doubles')).toBeTruthy();
  });

  it('FBX Conversion tab renders monospace path inputs', () => {
    render(<FBXConversionTab />);
    expect(screen.getByText('Input FBX Path')).toBeTruthy();
    const input = screen.getByPlaceholderText('C:/Assets/model.fbx');
    expect(input.classList.contains('font-mono')).toBe(true);
  });

  it('shows the disconnected notice and disables submit when offline', () => {
    setConnected(false);
    render(<LODGenerationTab />);
    expect(screen.getByText(/connect to blender mcp first/i)).toBeTruthy();
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });

  it('hides the notice and enables submit once connected and a target is named', () => {
    render(<LODGenerationTab />);
    const btn = screen.getByRole('button');
    // Required field empty → still disabled, notice already hidden (connected).
    expect(screen.queryByText(/connect to blender mcp first/i)).toBeNull();
    expect(btn.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('e.g. SM_Sword'), {
      target: { value: 'SM_Sword' },
    });
    expect(btn.hasAttribute('disabled')).toBe(false);
  });

  it('FBX Convert is a headless file job: enabled with the bridge DOWN, POSTs fbx-convert once, never execute', async () => {
    setConnected(false);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: { converted: true, url: '/api/visual-gen/asset/m.glb?dir=converted', name: 'm.glb', meshes: 3, tris: 12840, bytes: 4096 },
    })));
    vi.stubGlobal('fetch', fetchMock);
    try {
      render(<FBXConversionTab />);
      expect(screen.queryByText(/connect to blender mcp first/i)).toBeNull();
      fireEvent.change(screen.getByPlaceholderText('C:/Assets/model.fbx'), { target: { value: 'C:/in/m.fbx' } });
      const btn = screen.getByRole('button', { name: /convert/i });
      expect(btn.hasAttribute('disabled')).toBe(false);
      fireEvent.click(btn);
      await waitFor(() => expect(screen.getByText(/12,840/)).toBeTruthy());
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.filter((u) => u === '/api/visual-gen/fbx-convert')).toHaveLength(1);
      expect(urls.some((u) => u.includes('/api/blender-mcp/execute'))).toBe(false);
      const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
      expect(body).toEqual({ inputPath: 'C:/in/m.fbx', draco: false });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
