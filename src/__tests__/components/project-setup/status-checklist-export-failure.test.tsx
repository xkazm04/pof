import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { StatusChecklist } from '@/components/modules/project-setup/StatusChecklist';

afterEach(cleanup);

const onManifestExported = vi.fn();

function renderChecklist() {
  render(
    <StatusChecklist
      checklist={[{ id: 'engine', label: 'Unreal Engine', ok: true, detail: 'UE 5.8' }]}
      scanning={false}
      okCount={1}
      missingToolCount={0}
      isBootstrapping={false}
      onScan={vi.fn()}
      onFixAllMissing={vi.fn()}
      onBootstrapFromManifest={vi.fn()}
      onManifestExported={onManifestExported}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('StatusChecklist manifest export outcomes', () => {
  it('says why when the manifest could not be generated', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ success: false, error: 'detector crashed' }),
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;
    renderChecklist();
    fireEvent.click(screen.getByText('Export Manifest'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('detector crashed'));
    expect(onManifestExported).not.toHaveBeenCalled();
  });

  it('points at the preview when only the clipboard refused', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { manifest: { version: 1 } } }),
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    renderChecklist();
    fireEvent.click(screen.getByText('Export Manifest'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('copy it from the preview'));
    expect(onManifestExported).toHaveBeenCalledTimes(1);
  });
});
