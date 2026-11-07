/**
 * Blender pipeline tabs report what Blender CONFIRMED, not that a call returned.
 * (scan-sweep night 2026-11-08, context blender-pipeline)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { MeshOptimizationTab, FBXConversionTab } from '@/components/modules/visual-gen/blender-pipeline/BlenderPipelineView';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { useBlenderStore } from '@/components/modules/visual-gen/blender-pipeline/useBlenderStore';
import { parseReceipts } from '@/lib/blender-mcp/receipt';

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

function executeReply(output: string) {
  return new Response(JSON.stringify({ success: true, data: { output, receipts: parseReceipts(output) } }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  setConnected(true);
  useBlenderStore.setState({ scripts: [] });
});

describe('Mesh Optimization reads its optimize-mesh receipt', () => {
  async function runWith(output: string) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(executeReply(output)));
    render(<MeshOptimizationTab />);
    fireEvent.change(screen.getByPlaceholderText('e.g. SM_Character'), { target: { value: 'SM_Rock' } });
    fireEvent.click(screen.getByRole('button', { name: /optimize mesh/i }));
    await waitFor(() => expect(useBlenderStore.getState().scripts[0]?.status).not.toBe('running'));
  }

  it('a confirmed receipt reports the vertex counts Blender measured', async () => {
    await runWith('Optimized SM_Rock: 120 -> 96 vertices (removed 24)\nPOF_RESULT={"kind":"optimize-mesh","before":120,"after":96}');
    await waitFor(() => expect(screen.getByText('Run succeeded')).toBeTruthy());
    expect(screen.getByText(/120 → 96 vertices \(removed 24\)/)).toBeTruthy();
  });

  it('output with no receipt is NOT painted as success', async () => {
    await runWith('some prose the addon printed');
    await waitFor(() => expect(screen.getByText(/no 'optimize-mesh' receipt/)).toBeTruthy());
    expect(screen.queryByText('Run succeeded')).toBeNull();
  });
});

describe('FBX Conversion receipt states only what the route measured', () => {
  async function convertWith(data: Record<string, unknown>) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data }))));
    render(<FBXConversionTab />);
    fireEvent.change(screen.getByPlaceholderText('C:/Assets/model.fbx'), { target: { value: 'C:/in/m.fbx' } });
    fireEvent.click(screen.getByRole('button', { name: /convert/i }));
    await waitFor(() => expect(screen.getByText('Run succeeded')).toBeTruthy());
    return screen.getByRole('status').textContent ?? '';
  }

  it('missing counts (NaN serialised as null) read "unknown", never "0"', async () => {
    const text = await convertWith({ converted: true, name: 'm.glb', url: '/x', meshes: null, tris: null, bytes: 4096 });
    expect(text).not.toMatch(/\b0 mesh/);
    expect(text).not.toMatch(/\b0 triangles/);
    expect(text).toMatch(/mesh count unknown/);
    expect(text).toMatch(/triangle count unknown/);
  });

  it('measured counts still print as numbers', async () => {
    const text = await convertWith({ converted: true, name: 'm.glb', url: '/x', meshes: 1, tris: 12840, bytes: 4096 });
    expect(text).toMatch(/1 mesh ·/);
    expect(text).toMatch(/12,840 triangles/);
  });
});
