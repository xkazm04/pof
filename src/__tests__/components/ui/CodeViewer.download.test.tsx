import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { CodeViewer } from '@/components/ui/CodeViewer';
import { downloadBlob } from '@/lib/download';

vi.mock('@/lib/shiki-highlighter', () => ({
  getCachedHighlight: () => null,
  highlight: () => new Promise(() => {}),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function stubUrl() {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
}

describe('code download', () => {
  it('CodeViewer defers revoking the blob URL past the click', () => {
    vi.useFakeTimers();
    stubUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { getByLabelText } = render(<CodeViewer code="x" fileName="A.cpp" />);
    fireEvent.click(getByLabelText('Download A.cpp'));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('downloadBlob attaches the anchor for the click and removes it after', () => {
    vi.useFakeTimers();
    stubUrl();
    let attached = false;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      attached = document.body.contains(this);
    });
    downloadBlob(new Blob(['x']), 'a.txt');
    expect(attached).toBe(true);
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
