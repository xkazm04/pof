import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { GenomeImportPanel } from '@/components/modules/core-engine/unique-tabs/_genome-share/GenomeImportPanel';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

interface G { name: string }

function setup(sanitize: (raw: unknown) => { genome: G; warnings: string[] } | { error: string }) {
  return render(
    <GenomeImportPanel<G>
      kind="item" kindLabel="item" accent="#fff" baseline={undefined} baselineName="base"
      getName={(g) => g.name} sanitize={sanitize} diffSpecs={[]} onApply={() => {}} onClose={() => {}}
    />,
  );
}

describe('GenomeImportPanel failure paths report a reason', () => {
  it('a FileReader read error renders an error line', async () => {
    class FailingReader {
      onload: unknown = null;
      onerror: (() => void) | null = null;
      readAsText() { queueMicrotask(() => this.onerror?.()); }
    }
    vi.stubGlobal('FileReader', FailingReader);
    const { container } = setup(() => ({ error: 'unused' }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'broken.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(container.textContent).toContain('Could not read broken.json'));
  });

  it('a throwing sanitize renders its message and the panel is not left busy', async () => {
    const { container, getByText } = setup(() => { throw new Error('sanitizer exploded'); });
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '{"name":"a"}' } });
    fireEvent.click(getByText(/Preview Changes/));
    await waitFor(() => expect(container.textContent).toContain('sanitizer exploded'));
    expect(container.textContent).not.toContain('Decoding');
  });
});
