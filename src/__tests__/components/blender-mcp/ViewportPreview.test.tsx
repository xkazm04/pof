import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { ViewportPreview } from '@/components/blender-mcp/ViewportPreview';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

afterEach(cleanup);

beforeEach(() => {
  // Reset store transient state between tests
  useBlenderMCPStore.setState({
    connection: { host: '127.0.0.1', port: 9876, connected: true, blenderVersion: '4.2' },
    isConnecting: false,
    lastError: null,
    recentScreenshots: [],
  });
  // jsdom doesn't implement URL.createObjectURL by default
  globalThis.URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock/${(blob as Blob).size}`);
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('ViewportPreview', () => {
  it('renders all three recent screenshots as a filmstrip with the newest active', () => {
    useBlenderMCPStore.setState({
      recentScreenshots: ['blob:c', 'blob:b', 'blob:a'],
    });
    render(<ViewportPreview />);
    const strip = screen.getByRole('listbox', { name: /recent viewport screenshots/i });
    const thumbs = strip.querySelectorAll('button[role="option"]');
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0].getAttribute('aria-selected')).toBe('true');
    expect(thumbs[1].getAttribute('aria-selected')).toBe('false');
    expect(thumbs[2].getAttribute('aria-selected')).toBe('false');
  });

  it('clicking a thumbnail switches the active screenshot', () => {
    useBlenderMCPStore.setState({
      recentScreenshots: ['blob:c', 'blob:b', 'blob:a'],
    });
    render(<ViewportPreview />);
    const strip = screen.getByRole('listbox', { name: /recent viewport screenshots/i });
    const thumbs = strip.querySelectorAll('button[role="option"]');
    fireEvent.click(thumbs[2]);
    expect(thumbs[2].getAttribute('aria-selected')).toBe('true');
    expect(thumbs[0].getAttribute('aria-selected')).toBe('false');
  });

  it('surfaces a capture failure as an inline error chip instead of failing silently', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ success: false, error: 'Bridge unreachable' }),
      text: () => Promise.resolve('{}'),
    }) as unknown as typeof fetch;

    render(<ViewportPreview />);
    fireEvent.click(screen.getByRole('button', { name: /capture viewport screenshot/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.getByRole('alert').textContent).toMatch(/Bridge unreachable|capture failed/i);
  });

  it('opens the lightbox when the active screenshot is clicked', () => {
    useBlenderMCPStore.setState({
      recentScreenshots: ['blob:only-one'],
    });
    render(<ViewportPreview />);
    fireEvent.click(screen.getByRole('button', { name: /open screenshot in lightbox/i }));
    expect(screen.getByRole('dialog', { name: /zoomed/i })).toBeTruthy();
  });

  it('hides the filmstrip when no screenshots are present', () => {
    render(<ViewportPreview />);
    expect(screen.queryByRole('listbox', { name: /recent viewport screenshots/i })).toBeNull();
  });

  it('shows a connect hint when not connected', () => {
    useBlenderMCPStore.setState({
      connection: { host: '127.0.0.1', port: 9876, connected: false },
    });
    render(<ViewportPreview />);
    expect(screen.getByText(/connect to blender first/i)).toBeTruthy();
  });
});
