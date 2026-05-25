import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Mock the shared Shiki module so the test never loads WASM grammars and we can
// drive the async highlight deterministically.
vi.mock('@/lib/shiki-highlighter', () => ({
  getCachedHighlight: vi.fn(() => null),
  highlight: vi.fn(
    async (code: string) =>
      `<pre class="shiki"><code><span class="line">${code}</span></code></pre>`,
  ),
}));

// Mock sonner so we can assert on the confirmation toast. `vi.hoisted` lets the
// spies exist before the hoisted `vi.mock` factory runs.
const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

import { CodeViewer } from '@/components/ui/CodeViewer';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => cleanup());

describe('CodeViewer', () => {
  it('renders the filename and a language badge derived from the extension', () => {
    const { getByText } = render(
      <CodeViewer code="int x = 1;" fileName="UPoFSwordAdapter.h" />,
    );
    expect(getByText('UPoFSwordAdapter.h')).toBeTruthy();
    expect(getByText('C++ Header')).toBeTruthy();
  });

  it('labels .cpp files as C++', () => {
    const { getByText } = render(
      <CodeViewer code="void Foo() {}" fileName="UPoFSwordAdapter.cpp" />,
    );
    expect(getByText('C++')).toBeTruthy();
  });

  it('shows a plain-text fallback, then swaps in highlighted HTML with .line spans', async () => {
    const { container } = render(
      <CodeViewer code="int answer = 42;" fileName="A.h" />,
    );
    // Fallback <pre> renders the raw code synchronously.
    expect(container.querySelector('pre')?.textContent).toContain('int answer = 42;');

    await waitFor(() => {
      expect(container.querySelector('.code-viewer-shiki')).toBeTruthy();
    });
    expect(container.querySelector('.code-viewer-shiki .line')?.textContent).toContain(
      'int answer = 42;',
    );
  });

  it('copies the code to the clipboard and shows a confirmation toast', async () => {
    const { getByRole } = render(<CodeViewer code="copy me" fileName="A.h" />);
    fireEvent.click(getByRole('button', { name: 'Copy code' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('copy me');
      expect(toastSuccess).toHaveBeenCalledWith('Copied A.h to clipboard');
    });
    // Checkmark confirmation: the button's accessible name flips to "Copied".
    await waitFor(() =>
      expect(getByRole('button', { name: 'Copied to clipboard' })).toBeTruthy(),
    );
  });

  it('downloads the code as a file and shows a confirmation toast', () => {
    const { getByRole } = render(
      <CodeViewer code="download me" fileName="UPoFSwordAdapter.cpp" />,
    );
    fireEvent.click(getByRole('button', { name: 'Download UPoFSwordAdapter.cpp' }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith('Downloaded UPoFSwordAdapter.cpp');
  });
});
