import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

// scan-sweep 2026-11-08 cli-terminal-shell: header buttons carry the focus ring and the
// height handle is a keyboard-operable separator.

vi.mock('@/lib/api-utils', () => ({ apiFetch: vi.fn(() => Promise.resolve({})) }));
vi.mock('@/components/cli/CompactTerminal', () => ({ CompactTerminal: () => null }));

import { InlineTerminal } from '@/components/cli/InlineTerminal';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';

afterEach(cleanup);

describe('InlineTerminal keyboard parity', () => {
  it('Minimize and Close carry focus-ring', () => {
    const id = useCLIPanelStore.getState().createSession({ label: 'T' });
    const { getByLabelText } = render(<InlineTerminal sessionId={id} />);
    expect(getByLabelText('Minimize to bottom bar').className).toContain('focus-ring');
    expect(getByLabelText('Close terminal').className).toContain('focus-ring');
  });

  it('the resize separator is focusable and ArrowUp/Down change the height within bounds', () => {
    const id = useCLIPanelStore.getState().createSession({ label: 'T' });
    useCLIPanelStore.getState().setInlineTerminalHeight(300);
    const { getByRole } = render(<InlineTerminal sessionId={id} minHeight={150} maxHeight={320} />);
    const sep = getByRole('separator');
    expect(sep.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(sep, { key: 'ArrowUp' });
    expect(useCLIPanelStore.getState().inlineTerminalHeight).toBe(320);
    fireEvent.keyDown(sep, { key: 'ArrowUp' });
    expect(useCLIPanelStore.getState().inlineTerminalHeight).toBe(320);
    fireEvent.keyDown(sep, { key: 'ArrowDown' });
    expect(useCLIPanelStore.getState().inlineTerminalHeight).toBe(300);
  });
});
