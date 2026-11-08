import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ExportPanel } from '@/components/modules/core-engine/sub_combat/choreography/panels';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Encounter ExportPanel .h download', () => {
  let revoke: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    revoke = vi.fn();
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: revoke });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('does not revoke the blob URL in the same tick as the click (0-byte download race)', () => {
    const { getByText } = render(<ExportPanel exportConfig="// cfg" onCopy={() => {}} copyState="idle" />);
    fireEvent.click(getByText('.h').closest('button')!);
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});
