import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { PerformanceProfilingView } from '@/components/modules/evaluator/PerformanceProfilingView';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';

const initial = usePerformanceProfilingStore.getState();

beforeEach(() => {
  usePerformanceProfilingStore.setState({
    ...initial,
    sessionList: [],
    activeSession: null,
    isImporting: false,
    listSessions: vi.fn(async () => {}),
    // An import that stays in flight: the store flips its shared busy flag and never settles.
    importCSV: vi.fn(() => {
      usePerformanceProfilingStore.setState({ isImporting: true });
      return new Promise(() => {});
    }) as unknown as typeof initial.importCSV,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  usePerformanceProfilingStore.setState(initial, true);
});

const button = (container: HTMLElement, text: RegExp) =>
  Array.from(container.querySelectorAll('button')).find((b) => text.test(b.textContent ?? ''));

describe('PerformanceProfilingView busy label names the running action', () => {
  it('does not say "Generating..." while a CSV import is in flight', async () => {
    class OkReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText() { this.result = 'frame,ms\n1,16'; this.onload?.(); }
    }
    vi.stubGlobal('FileReader', OkReader);

    const { container } = render(<PerformanceProfilingView />);
    await act(async () => { fireEvent.click(button(container, /Import CSV/)!); });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(['x'], 'cap.csv')] } });
    });
    await act(async () => { fireEvent.click(button(container, /Import & Analyze/)!); });

    expect(usePerformanceProfilingStore.getState().isImporting).toBe(true);
    expect(container.textContent ?? '').not.toContain('Generating...');
  });
});
