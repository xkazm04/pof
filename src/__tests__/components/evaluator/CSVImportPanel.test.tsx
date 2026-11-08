import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
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
