import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

// src/lib/chart-colors.ts carries unresolved git-stash-pop conflict markers
// (another session's WIP, not ours to resolve) which break vite's transform
// for any importer of CLITabBar.tsx. Stub the module rather than touch it.
vi.mock('@/lib/chart-colors', () => ({ MODULE_COLORS: { core: 'rgb(136,136,136)' } }));

const { TabRenameInput } = await import('@/components/layout/CLITabBar');

afterEach(cleanup);

// A real browser fires a native blur when a focused element is removed from
// the DOM — jsdom does not reproduce that quirk, so a full CLITabBar mount/
// unmount test can't actually exercise the race. Testing TabRenameInput's
// own blur-guard directly, without relying on it ever actually unmounting,
// is the deterministic way to prove the guard works.
describe('TabRenameInput — Escape must discard even if blur fires right after', () => {
  it('Escape sets the cancel guard, so a blur that follows does not commit', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <TabRenameInput currentLabel="Original" onCommit={onCommit} onCancel={onCancel} />,
    );
    const input = container.querySelector('input')!;

    fireEvent.change(input, { target: { value: 'Edited' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Simulates the real-browser blur a DOM removal would trigger — the
    // component is deliberately kept mounted here so this blur can reach it.
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a blur with no preceding Escape still commits (the guard is not globally sticky)', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <TabRenameInput currentLabel="Original" onCommit={onCommit} onCancel={onCancel} />,
    );
    const input = container.querySelector('input')!;

    fireEvent.change(input, { target: { value: 'Edited' } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith('Edited');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Enter commits the edited value', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <TabRenameInput currentLabel="Original" onCommit={onCommit} onCancel={onCancel} />,
    );
    const input = container.querySelector('input')!;

    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith('Renamed');
    expect(onCancel).not.toHaveBeenCalled();
  });
});
