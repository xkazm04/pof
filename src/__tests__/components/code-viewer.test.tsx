import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Mock the shared Shiki module so the test never loads WASM grammars and we can
// drive the async highlight deterministically. One `.line` span per source
// line, like Shiki's own output.
vi.mock('@/lib/shiki-highlighter', () => ({
  getCachedHighlight: vi.fn(() => null),
  highlight: vi.fn(
    async (code: string) =>
      `<pre class="shiki"><code>${code
        .split('\n')
        .map((l) => `<span class="line">${l}</span>`)
        .join('\n')}</code></pre>`,
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
import { highlight } from '@/lib/shiki-highlighter';

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

  // One unkeyed CodeViewer receiving new code (TranspilePane's .h/.cpp tabs)
  // used to keep the FIRST file's highlighted HTML: `html` was initialised once
  // and the effect returned early whenever it was non-null.
  it('re-highlights when the code prop changes (no stale body from the previous file)', async () => {
    const { container, rerender } = render(<CodeViewer code="HEADER_A" fileName="A.h" />);
    await waitFor(() => expect(container.querySelector('.code-viewer-shiki')?.textContent).toContain('HEADER_A'));
    rerender(<CodeViewer code="SOURCE_B" fileName="A.cpp" />);
    await waitFor(() => expect(container.querySelector('.code-viewer-shiki')?.textContent).toContain('SOURCE_B'));
    expect(container.textContent).not.toContain('HEADER_A');
  });

  it('[guard] stable code is highlighted once — a rerender with the same code does not re-request or flash', async () => {
    const { container, rerender } = render(<CodeViewer code="int a;" fileName="A.h" />);
    await waitFor(() => expect(container.querySelector('.code-viewer-shiki')).toBeTruthy());
    rerender(<CodeViewer code="int a;" fileName="Renamed.h" />);
    expect(container.querySelector('.code-viewer-shiki')?.textContent).toContain('int a;');
    expect(highlight).toHaveBeenCalledTimes(1);
  });

  it('focusLine marks that line and scrolls it into view once highlighted', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { container } = render(<CodeViewer code={'one\ntwo\nthree\nfour'} fileName="A.cpp" focusLine={3} />);
    await waitFor(() => expect(container.querySelectorAll('.code-viewer-shiki .line')).toHaveLength(4));
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    const lines = container.querySelectorAll('.code-viewer-shiki .line');
    expect(lines[2].getAttribute('data-focused')).toBe('true');
    expect(lines[2].textContent).toBe('three');
    expect(container.querySelectorAll('[data-focused="true"]')).toHaveLength(1);
  });

  it('[guard] without focusLine no line is marked and nothing scrolls', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { container } = render(<CodeViewer code={'one\ntwo'} fileName="A.cpp" />);
    await waitFor(() => expect(container.querySelectorAll('.code-viewer-shiki .line')).toHaveLength(2));
    expect(container.querySelector('[data-focused]')).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
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
