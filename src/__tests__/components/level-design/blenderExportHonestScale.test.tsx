import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { ProceduralLevelWizard } from '@/components/modules/content/level-design/ProceduralLevelWizard';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { DEFAULT_BLENDER_HOST, DEFAULT_BLENDER_PORT } from '@/lib/blender-mcp/types';
import { FLOOR_CELL_TYPES, CELL_TYPE_CODES } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';

afterEach(cleanup);

/** Every `/api/blender-mcp/execute` body this test run sent. */
let dispatched: string[] = [];

beforeEach(() => {
  dispatched = [];
  act(() => {
    useBlenderMCPStore.setState({
      connection: { host: DEFAULT_BLENDER_HOST, port: DEFAULT_BLENDER_PORT, connected: true },
    });
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/blender-mcp/execute')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { code?: string };
        dispatched.push(body.code ?? '');
        return new Response(JSON.stringify({ success: true, data: { output: '' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWizard() {
  return render(<ProceduralLevelWizard onGenerate={vi.fn()} isGenerating={false} />);
}

/** Grid Width / Grid Height are the first two range inputs in Size Parameters. */
function setGridSize(container: HTMLElement, width: number, height: number) {
  const ranges = container.querySelectorAll<HTMLInputElement>('input[type="range"]');
  fireEvent.change(ranges[0], { target: { value: String(width) } });
  fireEvent.change(ranges[1], { target: { value: String(height) } });
}

function openExport(getByRole: ReturnType<typeof render>['getByRole']) {
  fireEvent.click(getByRole('button', { name: /Export to Blender/i }));
}

/** `rows, cols = R, C` as written into the generated Python. */
function scriptDims(code: string): [number, number] {
  const m = code.match(/rows,\s*cols\s*=\s*(\d+),\s*(\d+)/);
  if (!m) throw new Error('no rows/cols line in generated script');
  return [Number(m[1]), Number(m[2])];
}

describe('the Blender export never silently downscales', () => {
  it('exports the FULL 256x256 open-world config, and says so before confirming', async () => {
    // The defect: the preview is capped at 96 per side for interactive
    // smoothness and the export shipped that grid — a 256x256 config left as a
    // 96x96 level while every number on screen still said 256.
    const { container, getByRole, getByTestId } = renderWizard();
    setGridSize(container, 256, 256);
    openExport(getByRole);

    // Stated BEFORE anything is sent.
    expect(getByTestId('blender-export-dimensions').textContent).toBe('256 x 256');
    expect(getByTestId('blender-export-scale').textContent).toBe('100%');
    expect(getByTestId('blender-export-headline').textContent).toMatch(/full requested size/i);
    expect(dispatched).toHaveLength(0);

    await act(async () => {
      fireEvent.click(getByTestId('blender-export-run'));
    });

    expect(dispatched).toHaveLength(1);
    expect(scriptDims(dispatched[0])).toEqual([256, 256]);
  });

  it('states the real size and scale when the request exceeds the export bound', async () => {
    // 512 per side is reachable from the sliders and above the 256 bound, so
    // this export IS downscaled — and must say the exported size, the requested
    // size and the scale between them, before the operator commits.
    const { container, getByRole, getByTestId } = renderWizard();
    setGridSize(container, 512, 512);
    openExport(getByRole);

    expect(getByTestId('blender-export-dimensions').textContent).toBe('256 x 256');
    const headline = getByTestId('blender-export-headline').textContent ?? '';
    expect(headline).toMatch(/DOWNSCALED/);
    expect(headline).toMatch(/512x512/);
    expect(getByTestId('blender-export-scale').textContent).toBe('50%');

    await act(async () => {
      fireEvent.click(getByTestId('blender-export-run'));
    });
    expect(scriptDims(dispatched[0])).toEqual([256, 256]);
  });

  it('sends nothing until the stated size is confirmed, and cancel sends nothing at all', () => {
    const { container, getByRole, getByTestId, queryByTestId } = renderWizard();
    setGridSize(container, 128, 128);
    openExport(getByRole);
    expect(queryByTestId('blender-export-confirm')).toBeTruthy();
    expect(dispatched).toHaveLength(0);

    fireEvent.click(getByTestId('blender-export-cancel'));
    expect(queryByTestId('blender-export-confirm')).toBeNull();
    expect(dispatched).toHaveLength(0);
  });

  it('names the seed it will use, resolved to the value FRandomStream gets', () => {
    const { container, getByRole, getByTestId, getByPlaceholderText } = renderWizard();
    fireEvent.change(getByPlaceholderText('0xRND...'), { target: { value: '7' } });
    setGridSize(container, 64, 64);
    openExport(getByRole);
    expect(getByTestId('blender-export-seed').textContent).toBe('7 → 7');
  });

  it('reports the Blender object count the script will create', () => {
    const { container, getByRole, getByTestId } = renderWizard();
    setGridSize(container, 64, 64);
    openExport(getByRole);
    const objects = Number((getByTestId('blender-export-objects').textContent ?? '').replace(/,/g, ''));
    expect(objects).toBeGreaterThan(0);
    expect(objects).toBeLessThanOrEqual(64 * 64);
  });
});

describe('the generated script states its own provenance', () => {
  it('writes grid size, scale and seed into the header comment', async () => {
    const { container, getByRole, getByTestId, getByPlaceholderText } = renderWizard();
    fireEvent.change(getByPlaceholderText('0xRND...'), { target: { value: 'ash-vault' } });
    setGridSize(container, 128, 128);
    openExport(getByRole);
    await act(async () => {
      fireEvent.click(getByTestId('blender-export-run'));
    });

    const header = dispatched[0].split('import bpy')[0];
    expect(header).toMatch(/PoF procedural level export/);
    expect(header).toMatch(/128x128 cells \(FULL requested size, scale 100%\)/);
    expect(header).toMatch(/Algorithm: bsp/);
    expect(header).toMatch(/Seed:\s+ash-vault →/);
  });

  it('says DOWNSCALED in the header when it is', async () => {
    const { container, getByRole, getByTestId } = renderWizard();
    setGridSize(container, 512, 256);
    openExport(getByRole);
    await act(async () => {
      fireEvent.click(getByTestId('blender-export-run'));
    });

    const header = dispatched[0].split('import bpy')[0];
    expect(header).toMatch(/DOWNSCALED from the requested 512x256/);
    expect(header).toMatch(/scale 50%/);
  });
});

describe('exported spawn markers stand on real floor', () => {
  it('places every marker on a cell the script emits a floor plane for', async () => {
    const { container, getByRole, getByTestId } = renderWizard();
    setGridSize(container, 96, 96);
    openExport(getByRole);
    await act(async () => {
      fireEvent.click(getByTestId('blender-export-run'));
    });

    const code = dispatched[0];
    // Rebuild the grid the script itself carries, then check each marker's cell.
    const flat = (code.match(/^grid = \[([\d,]+)\]$/m)?.[1] ?? '').split(',').map(Number);
    const [rows, cols] = scriptDims(code);
    expect(flat).toHaveLength(rows * cols);
    const floorCodes = new Set(FLOOR_CELL_TYPES.map((c) => CELL_TYPE_CODES[c]));

    const markers = Array.from(
      code.matchAll(/empty_add\(type='PLAIN_AXES', location=\((-?\d+), (-?\d+), 0\)\)/g),
    ).map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    expect(markers.length).toBe(3); // player + boss + loot are on by default

    for (const marker of markers) {
      // The geometry script lays cells at x = col * cell_size, y = row * cell_size.
      const col = marker.x / 2;
      const row = marker.y / 2;
      expect(Number.isInteger(col) && Number.isInteger(row)).toBe(true);
      expect(floorCodes.has(flat[row * cols + col])).toBe(true);
    }
  });

  it('states where the markers ended up before the export runs', () => {
    const { container, getByRole, getByTestId } = renderWizard();
    setGridSize(container, 96, 96);
    openExport(getByRole);
    expect(getByTestId('blender-export-spawns').textContent).toMatch(/spawn markers on floor cells/);
  });
});
