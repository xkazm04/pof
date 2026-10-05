import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { AudioCodeGenPanel } from '@/components/modules/content/audio/AudioCodeGenPanel';
import { apiFetch } from '@/lib/api-utils';
import type { AudioSceneDocument } from '@/types/audio-scene';
import type { CodeGenResult } from '@/lib/audio-codegen';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);
vi.mock('@/lib/api-utils', () => ({ apiFetch: vi.fn() }));

const doc = { id: 1, zones: [{ id: 'z1' }], emitters: [], globalReverbPreset: 'none' } as unknown as AudioSceneDocument;
const result: CodeGenResult = {
  files: [{ filename: 'A.h', category: 'reverb', language: 'h', content: 'x', lineCount: 1 }],
  stats: { totalFiles: 1, totalLines: 1, zonesProcessed: 1, emittersProcessed: 0 },
} as unknown as CodeGenResult;

/**
 * handleCopy used to `await navigator.clipboard.writeText(...)` with no
 * try/catch: a rejected write (denied permission, insecure context) threw out
 * of the onClick handler as an unhandled rejection, with no success claimed
 * AND no failure shown — the user saw the button do nothing. This pins that a
 * rejected write no longer throws unhandled and never flips to "Copied!".
 */
describe('AudioCodeGenPanel — a rejected clipboard write never claims success', () => {
  it('a failed copy does not show "Copied!" and does not throw unhandled', async () => {
    (apiFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(result);
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });

    render(<AudioCodeGenPanel doc={doc} accentColor="#fff" />);
    fireEvent.click(screen.getByRole('button', { name: /generate c\+\+ code/i }));
    await waitFor(() => expect(screen.getByText('A.h')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /copy a\.h/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());

    // Give the rejected promise a tick; no unhandled rejection should propagate
    // out of this test, and the button must not read "Copied".
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/copied a\.h/i)).toBeNull();
  });
});
