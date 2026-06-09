import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BlenderSetupWizard } from '@/components/blender-mcp/BlenderSetupWizard';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { BLENDER_ADDON_REPO_URL } from '@/lib/blender-mcp/diagnostics';

afterEach(cleanup);

beforeEach(() => {
  useBlenderMCPStore.setState({
    host: 'localhost',
    port: 9876,
    autoConnect: false,
    connection: { host: 'localhost', port: 9876, connected: false },
    isConnecting: false,
    lastError: null,
    recentScreenshots: [],
    retryAttempt: 0,
    autoRetrying: false,
    autoConnectAttempted: false,
  });
});

const ECONNREFUSED_DEFAULT =
  'Connection failed: connect ECONNREFUSED 127.0.0.1:9876';

describe('BlenderSetupWizard', () => {
  it('does not render a dialog when closed', () => {
    render(<BlenderSetupWizard open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a success state when Blender is connected', () => {
    useBlenderMCPStore.setState({
      connection: { host: 'localhost', port: 9876, connected: true, blenderVersion: '4.2' },
    });
    render(<BlenderSetupWizard open onClose={() => {}} />);
    expect(screen.getByText(/connected to blender/i)).toBeTruthy();
  });

  it('surfaces a Blender-not-running diagnosis with an addon install link', () => {
    useBlenderMCPStore.setState({ lastError: ECONNREFUSED_DEFAULT });
    render(<BlenderSetupWizard open onClose={() => {}} />);

    expect(screen.getByText(/isn't running/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: /addon/i });
    expect(link.getAttribute('href')).toBe(BLENDER_ADDON_REPO_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel') ?? '').toContain('noopener');
  });

  it('surfaces a wrong-port diagnosis on a non-default port', () => {
    useBlenderMCPStore.setState({
      port: 5000,
      connection: { host: 'localhost', port: 5000, connected: false },
      lastError: 'Connection failed: connect ECONNREFUSED 127.0.0.1:5000',
    });
    render(<BlenderSetupWizard open onClose={() => {}} />);
    expect(screen.getByText(/wrong port/i)).toBeTruthy();
  });

  it('renders numbered fix steps for the detected failure mode', () => {
    useBlenderMCPStore.setState({ lastError: ECONNREFUSED_DEFAULT });
    render(<BlenderSetupWizard open onClose={() => {}} />);
    const steps = screen.getAllByRole('listitem');
    expect(steps.length).toBeGreaterThan(0);
  });

  it('dispatches connect with the edited host/port when testing the connection', () => {
    const connectSpy = vi.fn();
    useBlenderMCPStore.setState({
      lastError: ECONNREFUSED_DEFAULT,
      connect: connectSpy as never,
    });
    render(<BlenderSetupWizard open onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('Host'), {
      target: { value: '192.168.0.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));

    expect(connectSpy).toHaveBeenCalledWith('192.168.0.5', 9876);
  });

  it('toggles the persisted autoConnect preference via setAutoConnect', () => {
    const setAutoSpy = vi.fn();
    useBlenderMCPStore.setState({
      lastError: ECONNREFUSED_DEFAULT,
      setAutoConnect: setAutoSpy as never,
    });
    render(<BlenderSetupWizard open onClose={() => {}} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /auto-?connect/i }));
    expect(setAutoSpy).toHaveBeenCalledWith(true);
  });

  it('shows an auto-retry status while a backoff retry is pending', () => {
    useBlenderMCPStore.setState({
      lastError: ECONNREFUSED_DEFAULT,
      autoRetrying: true,
      retryAttempt: 2,
    });
    render(<BlenderSetupWizard open onClose={() => {}} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/auto-retrying/i);
    expect(status.textContent).toMatch(/attempt 3/i);
  });
});
