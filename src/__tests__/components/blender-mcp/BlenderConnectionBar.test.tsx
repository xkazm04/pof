import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

afterEach(cleanup);

beforeEach(() => {
  useBlenderMCPStore.setState({
    host: '127.0.0.1',
    port: 9876,
    autoConnect: false,
    connection: { host: '127.0.0.1', port: 9876, connected: false },
    isConnecting: false,
    lastError: null,
    recentScreenshots: [],
  });
});

describe('BlenderConnectionBar — accessibility', () => {
  it('exposes the status pill as a polite live region with a descriptive label', () => {
    useBlenderMCPStore.setState({
      connection: { host: '127.0.0.1', port: 9876, connected: true, blenderVersion: '4.2' },
    });
    render(<BlenderConnectionBar />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-label')).toMatch(/Connected.*4\.2/);
  });

  it('announces error banners via role="alert"', () => {
    useBlenderMCPStore.setState({ lastError: 'Bridge unreachable' });
    render(<BlenderConnectionBar />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/Bridge unreachable/);
  });

  it('labels the Settings icon button with aria-label and applies the unified focus-ring', () => {
    render(<BlenderConnectionBar />);
    const settings = screen.getByRole('button', { name: /connection settings/i });
    expect(settings.className).toContain('focus-ring');
    expect(settings.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles aria-expanded on the Settings button when opening the panel', () => {
    render(<BlenderConnectionBar />);
    const settings = screen.getByRole('button', { name: /connection settings/i });
    fireEvent.click(settings);
    expect(settings.getAttribute('aria-expanded')).toBe('true');
  });

  it('labels the Connect button with a descriptive aria-label when idle', () => {
    render(<BlenderConnectionBar />);
    const connect = screen.getByRole('button', { name: /connect to blender mcp/i });
    expect(connect.className).toContain('focus-ring');
    expect(connect.hasAttribute('disabled')).toBe(false);
  });

  it('shows an explanatory title and waiting label on the Connect button while connecting', () => {
    useBlenderMCPStore.setState({ isConnecting: true });
    render(<BlenderConnectionBar />);
    const connect = screen.getByRole('button', { name: /connecting to blender mcp, please wait/i });
    expect(connect.hasAttribute('disabled')).toBe(true);
    expect(connect.getAttribute('title')).toMatch(/connecting/i);
  });

  it('relabels the Connect button as Disconnect when connected', () => {
    useBlenderMCPStore.setState({
      connection: { host: '127.0.0.1', port: 9876, connected: true },
    });
    render(<BlenderConnectionBar />);
    expect(screen.getByRole('button', { name: /disconnect from blender mcp/i })).toBeTruthy();
  });

  it('exposes host and port inputs with accessible names, ids, and focus-ring', () => {
    render(<BlenderConnectionBar />);
    fireEvent.click(screen.getByRole('button', { name: /connection settings/i }));

    const host = screen.getByLabelText(/blender mcp host/i) as HTMLInputElement;
    const port = screen.getByLabelText(/blender mcp port/i) as HTMLInputElement;

    expect(host.id).toBe('blender-mcp-host');
    expect(port.id).toBe('blender-mcp-port');
    expect(host.className).toContain('focus-ring');
    expect(port.className).toContain('focus-ring');
  });

  it('marks the decorative status dot as aria-hidden so screen readers do not double-announce', () => {
    render(<BlenderConnectionBar />);
    const status = screen.getByRole('status');
    const dot = status.querySelector('span[aria-hidden="true"]');
    expect(dot).toBeTruthy();
  });
});
