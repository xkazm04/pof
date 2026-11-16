/** Four visible field captions were not bound to their controls, and toggles exposed no state. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';

vi.mock('@/components/modules/shared/ReviewableModuleView', () => ({
  ReviewableModuleView: ({ extraTabs }: { extraTabs: ExtraTab[] }) => <div>{extraTabs[0].render({} as never)}</div>,
}));

import { ImportAutomationView } from '@/components/modules/visual-gen/import-automation/ImportAutomationView';

afterEach(cleanup);

describe('ImportAutomationView field semantics', () => {
  it('binds each caption to its input', () => {
    render(<ImportAutomationView />);
    for (const name of ['Asset Name', 'Content Path']) {
      expect(screen.getByLabelText(name).tagName).toBe('INPUT');
    }
    expect(screen.getByLabelText(/^Shells/).tagName).toBe('INPUT');
  });

  it('exposes which format, mesh type and output is active', () => {
    render(<ImportAutomationView />);
    expect(screen.getByRole('button', { name: 'fbx', pressed: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'static', pressed: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import Script', pressed: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'DataAsset', pressed: false })).toBeTruthy();
  });
});
