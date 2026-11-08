import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { SessionRail } from '@/components/modules/evaluator/PerformanceProfilingView/SessionRail';
import { usePerformanceProfilingStore, type SessionListItem } from '@/stores/performanceProfilingStore';

afterEach(cleanup);

function row(id: string, name: string, importedAt: string): SessionListItem {
  return {
    id, name, source: 'csv', importedAt, frameCount: 100, avgFPS: 60,
    hasTriage: false, overallScore: null, bottleneck: null,
  };
}

function seed(rows: SessionListItem[], deleteSession = vi.fn(async () => {})) {
  usePerformanceProfilingStore.setState({ sessionList: rows, deleteSession });
  return deleteSession;
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === text);
}

describe('SessionRail: deleting a capture asks first', () => {
  it('does not delete on the trash click; deletes only after the confirm', async () => {
    const deleteSession = seed([row('s1', 'baseline', '2026-11-08T10:02:00Z')]);
    const { getByLabelText } = render(<SessionRail />);
    await act(async () => { fireEvent.click(getByLabelText('Delete session baseline')); });
    expect(deleteSession).not.toHaveBeenCalled();
    const confirm = buttonByText('Delete capture');
    expect(confirm).toBeDefined();
    await act(async () => { fireEvent.click(confirm!); });
    expect(deleteSession).toHaveBeenCalledTimes(1);
    expect(deleteSession).toHaveBeenCalledWith('s1');
  });

  it('cancel leaves the capture alone', async () => {
    const deleteSession = seed([row('s1', 'baseline', '2026-11-08T10:02:00Z')]);
    const { getByLabelText } = render(<SessionRail />);
    await act(async () => { fireEvent.click(getByLabelText('Delete session baseline')); });
    await act(async () => { fireEvent.click(buttonByText('Cancel')!); });
    expect(deleteSession).not.toHaveBeenCalled();
  });
});

describe('SessionRail: captures from different days are distinguishable', () => {
  it('renders different meta text for two captures 24h apart at the same clock time', () => {
    seed([
      row('s1', 'before', '2026-11-06T10:02:00Z'),
      row('s2', 'after', '2026-11-07T10:02:00Z'),
    ]);
    const { getByLabelText } = render(<SessionRail />);
    const meta = (name: string) => getByLabelText(`Open session ${name}`).querySelectorAll('span')[1]?.textContent ?? '';
    expect(meta('before')).not.toBe('');
    expect(meta('before').split(' · ')[0]).not.toBe(meta('after').split(' · ')[0]);
  });
});
