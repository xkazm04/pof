/**
 * ImportPanel — a failed import reports the reason the store recorded.
 *
 * `importCrashLog` returns null for EVERY failure (parse rejection, network
 * error, server 500) and records the real message in `store.error`. The panel
 * used to replace it with a fixed "Could not parse that log — check the format"
 * — so an operator whose server was down was told to fix their paste.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { ImportPanel } from '@/components/modules/evaluator/CrashAnalyzerView/ImportPanel';
import { useCrashAnalyzerStore } from '@/stores/crashAnalyzerStore';

const original = useCrashAnalyzerStore.getState().importCrashLog;
afterEach(() => {
  cleanup();
  useCrashAnalyzerStore.setState({ importCrashLog: original, error: null, isLoading: false });
});

async function importWithFailure(message: string) {
  useCrashAnalyzerStore.setState({
    importCrashLog: async () => {
      useCrashAnalyzerStore.setState({ error: message, isLoading: false });
      return null;
    },
  });
  const view = render(<ImportPanel />);
  const textarea = view.container.querySelector('textarea') as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value: 'LogWindows: Error: boom' } });
  const button = Array.from(view.container.querySelectorAll('button')).find((b) => b.textContent?.includes('Parse'))!;
  await act(async () => { fireEvent.click(button); });
  return view.container.textContent ?? '';
}

describe('ImportPanel — failure reason', () => {
  it('a server failure shows the server message, not a format complaint', async () => {
    const text = await importWithFailure('Crash analyzer error: SQLITE_BUSY: database is locked');
    expect(text).toContain('SQLITE_BUSY');
    expect(text).not.toContain('check the format');
  });

  it('a parse rejection still reads as a parse problem', async () => {
    const text = await importWithFailure('Could not parse crash log');
    expect(text).toContain('Could not parse');
  });
});
