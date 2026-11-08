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
import { ScriptRunner } from '@/components/modules/visual-gen/blender-pipeline/ScriptRunner';

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

describe('Mesh Optimization offers the measured-mesh picker like the LOD tab', () => {
  it('Read scene meshes fills a Measured meshes combobox that sets the object name', async () => {
    const sword = { name: 'SM_Rock', tris: 1200, verts: 640, polys: 600 };
    const out = 'stats\nPOF_RESULT=' + JSON.stringify({ kind: 'mesh-stats', meshes: [sword] });
    const fetchMock = vi.fn().mockResolvedValue(executeReply(out));
    vi.stubGlobal('fetch', fetchMock);
    render(<MeshOptimizationTab />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: /measured meshes/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /read scene meshes/i }));
    const picker = await screen.findByRole('combobox', { name: /measured meshes/i });
    expect(screen.getByRole('option', { name: /SM_Rock — 1,200 tris/ })).toBeTruthy();
    fireEvent.change(picker, { target: { value: 'SM_Rock' } });
    const input = screen.getByPlaceholderText('e.g. SM_Character') as HTMLInputElement;
    expect(input.value).toBe('SM_Rock');
    expect(useBlenderStore.getState().scripts[0].scriptName).toBe('Mesh Stats');
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

describe('FBX receipt sizes come from the shared lib/format formatBytes', () => {
  it('a sub-KB GLB reads in bytes, like every other byte label in the app', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, data: { converted: true, name: 'm.glb', url: '/x', meshes: 1, tris: 2, bytes: 512 },
    }))));
    render(<FBXConversionTab />);
    fireEvent.change(screen.getByPlaceholderText('C:/Assets/model.fbx'), { target: { value: 'C:/in/m.fbx' } });
    fireEvent.click(screen.getByRole('button', { name: /convert/i }));
    await waitFor(() => expect(screen.getByText('Run succeeded')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toMatch(/· 512 B/);
  });
});

describe('FBX path hint matches what the route accepts', () => {
  it('does not demand forward slashes: the route normalises backslashes (fbx-convert/route.ts)', () => {
    render(<FBXConversionTab />);
    const hint = screen.getByText(/Absolute path on this machine/).textContent ?? '';
    expect(hint).not.toMatch(/with forward slashes/);
    expect(hint).toMatch(/backslash/i);
  });
});

describe('Script history controls are reachable and named', () => {
  it('the icon-only remove button has an accessible name and both buttons show the focus ring', () => {
    useBlenderStore.setState({
      scripts: [{ id: 's1', scriptName: 'LOD Generation', args: [], status: 'completed', output: 'ok', startedAt: 1, completedAt: 2 }],
    });
    render(<ScriptRunner />);
    const remove = screen.getByRole('button', { name: /remove LOD Generation from the list/i });
    expect(remove.classList.contains('focus-ring')).toBe(true);
    expect(screen.getByRole('button', { name: /clear finished/i }).classList.contains('focus-ring')).toBe(true);
  });
});

describe('Script history states each job status in words, not by icon hue alone', () => {
  it('renders the STATUS_CONFIG label for done and failed jobs', () => {
    useBlenderStore.setState({
      scripts: [
        { id: 'a', scriptName: 'Mesh Stats', args: [], status: 'failed', output: '', error: 'boom', startedAt: 1, completedAt: 2 },
        { id: 'b', scriptName: 'LOD Generation', args: [], status: 'completed', output: 'ok', startedAt: 1, completedAt: 2 },
      ],
    });
    render(<ScriptRunner />);
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });
});
