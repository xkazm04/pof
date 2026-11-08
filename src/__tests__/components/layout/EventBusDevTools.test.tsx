import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { EventBusDevTools } from '@/components/layout/EventBusDevTools';
import { eventBus } from '@/lib/event-bus';
import type { BusEvent } from '@/types/event-bus';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const ev = (id: string, channel: string, source?: string, payload: unknown = {}) =>
  ({ id, channel, source, payload, timestamp: 1 }) as unknown as BusEvent;

function open(events: BusEvent[]) {
  vi.spyOn(eventBus, 'getReplayBuffer').mockReturnValue(events);
  render(<EventBusDevTools />);
  act(() => { fireEvent.keyDown(window, { key: 'E', ctrlKey: true, shiftKey: true }); });
}

describe('namespace chips', () => {
  it('a chip shows only its namespace, not channels or sources that contain the word', () => {
    open([ev('1', 'cli.start'), ev('2', 'build.done', 'cli-service'), ev('3', 'file.cli-output')]);
    fireEvent.click(screen.getByRole('button', { name: 'cli' }));
    expect(screen.getByText('cli.start')).toBeTruthy();
    expect(screen.queryByText('build.done')).toBeNull();
    expect(screen.queryByText('file.cli-output')).toBeNull();
  });
});

describe('event rows', () => {
  it('an unserializable payload renders a note instead of crashing the shell', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    open([ev('1', 'cli.start', undefined, circular)]);
    fireEvent.click(screen.getByRole('button', { name: /cli\.start/ }));
    expect(screen.getByText(/not serializable/i)).toBeTruthy();
  });

  it('the payload sits beside the toggle, not inside it, and the toggle reports its state', () => {
    open([ev('1', 'cli.start', undefined, { a: 1 })]);
    const row = screen.getByRole('button', { name: /cli\.start/ });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('pre')).toBeTruthy();
    expect(row.querySelector('pre')).toBeNull();
  });
});
