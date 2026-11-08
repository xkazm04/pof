import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { CSVImportPanel } from '@/components/modules/evaluator/PerformanceProfilingView/CSVImportPanel';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const noop = async () => {};

describe('CSVImportPanel copy matches its controls', () => {
  it('does not promise a paste path the panel does not have', () => {
    const { container } = render(<CSVImportPanel onImport={noop} isImporting={false} />);
    // No textarea / contenteditable exists, so the hint must not say "Paste".
    expect(container.querySelector('textarea, [contenteditable="true"]')).toBeNull();
    // textContent glues sibling text ("…AnalyzePaste…"), so no \b word boundary here.
    expect(container.textContent ?? '').not.toMatch(/paste/i);
  });
});

describe('CSVImportPanel session-name field has an accessible name', () => {
  it('is findable by label, not only by placeholder', () => {
    const { getByLabelText } = render(<CSVImportPanel onImport={noop} isImporting={false} />);
    const input = getByLabelText('Session name');
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('type')).toBe('text');
  });
});

describe('CSVImportPanel file read failure is not silent', () => {
  it('shows an alert when the FileReader errors', () => {
    class FailingReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText() { this.onerror?.(); }
    }
    vi.stubGlobal('FileReader', FailingReader);
    const { container } = render(<CSVImportPanel onImport={noop} isImporting={false} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['frame,ms\n1,16'], 'capture.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain('capture.csv');
  });
});
