import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { XpTableGenerator } from '@/components/modules/core-engine/sub_progression/_internals/XpTableGenerator';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function downloadName(exp: number): string {
  const names: string[] = [];
  const g = globalThis as unknown as { URL: { createObjectURL?: unknown; revokeObjectURL?: unknown } };
  g.URL.createObjectURL = () => 'blob:x';
  g.URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    names.push(this.download);
  });
  render(<XpTableGenerator baseXp={100} curveExp={exp} />);
  fireEvent.click(screen.getByRole('button', { name: /Download \.csv/ }));
  cleanup();
  return names[0];
}

describe('CSV download name identifies the curve', () => {
  it('exponents 1.55 and 1.6 (adjacent slider steps) get distinct names', () => {
    expect(downloadName(1.55)).not.toBe(downloadName(1.6));
  });
});
