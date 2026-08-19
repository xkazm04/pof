/* eslint-disable no-restricted-syntax -- the hex literals below are PBR base
   COLOURS under test (material data), not UI theme colours. */
/**
 * The "Export to UE5" affordance must state what it PRODUCED and what the user
 * must do next — and must never show a success message for a file nobody wrote.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { UE5ExportPanel } from '@/components/modules/visual-gen/material-lab/UE5ExportPanel';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

vi.mock('@/components/ui/CodeViewer', () => ({
  CodeViewer: ({ code, fileName }: { code: string; fileName: string }) => (
    <pre data-testid="code" data-filename={fileName}>{code}</pre>
  ),
}));

beforeEach(() => {
  useMaterialStore.setState({
    params: { baseColor: '#ffd700', metallic: 1, roughness: 0.2, normalStrength: 1.6, aoStrength: 0.4 },
    albedoTexture: null,
    normalTexture: null,
    metallicTexture: null,
    roughnessTexture: null,
    aoTexture: null,
  });
});

afterEach(cleanup);

describe('UE5ExportPanel', () => {
  it('renders the generated script for the lab\'s current values', () => {
    render(<UE5ExportPanel />);
    const code = screen.getByTestId('code');
    expect(code.getAttribute('data-filename')).toBe('MI_LabMaterial.py');
    expect(code.textContent).toContain('M_ARPG_Surface_Master');
    expect(code.textContent).toContain('"AOStrength": 0.4,');
  });

  it('says plainly that nothing was written to the UE project, and what to do next', () => {
    render(<UE5ExportPanel />);
    const body = document.body.textContent ?? '';
    expect(body).toContain('nothing has been written');
    expect(body).toContain('Output Log');
    expect(body).toMatch(/py "<path>\/MI_LabMaterial\.py"/);
    // No claim of a completed export anywhere on the panel.
    expect(body).not.toMatch(/exported successfully|Export complete|written to your project\b/i);
  });

  it('names a texture that cannot make the trip', () => {
    useMaterialStore.getState().setTexture('albedo', 'blob:http://localhost/abc');
    render(<UE5ExportPanel />);
    const dropped = screen.getByTestId('ue5-export-dropped');
    expect(dropped.textContent).toContain('Albedo texture');
    expect(dropped.textContent).toContain('blob:');
  });

  it('re-derives the asset path as the name is edited', () => {
    render(<UE5ExportPanel />);
    fireEvent.change(screen.getByLabelText('Asset name'), { target: { value: 'Rough Stone' } });
    expect(screen.getByText('/Game/PoF/Materials/MI_Rough_Stone')).toBeTruthy();
    expect(screen.getByTestId('code').getAttribute('data-filename')).toBe('MI_Rough_Stone.py');
  });
});
