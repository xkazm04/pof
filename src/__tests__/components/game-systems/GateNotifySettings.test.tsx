import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';
import { GateNotifySettings } from '@/components/modules/game-systems/GateNotifySettings';

function body(configOverrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      config: { enabled: false, webhookUrl: 'https://hooks.slack.com/services/T/B/X', target: 'slack', mode: 'failures', ...configOverrides },
      state: { lastSentAt: null, lastStatus: null, lastDetail: null, sentCount: 0 },
      outcome: { status: 'sent', detail: 'notified slack' },
    },
  };
}

beforeEach(() => {
  mockFetchRoutes([{ match: '/api/notify/gate', response: { body: body() } }]);
});
afterEach(cleanup);

describe('GateNotifySettings', () => {
  it('renders the fetched config (URL + target + mode)', async () => {
    render(<GateNotifySettings />);
    await waitFor(() => expect((screen.getByTestId('pof-gate-notify-url') as HTMLInputElement).value)
      .toBe('https://hooks.slack.com/services/T/B/X'));
    expect((screen.getByTestId('pof-gate-notify-target') as HTMLSelectElement).value).toBe('slack');
    expect((screen.getByTestId('pof-gate-notify-mode') as HTMLSelectElement).value).toBe('failures');
  });

  it('saves when the enable toggle is flipped', async () => {
    const fetchMock = mockFetchRoutes([{ match: '/api/notify/gate', response: { body: body() } }]);
    render(<GateNotifySettings />);
    await waitFor(() => expect(screen.getByTestId('pof-gate-notify-enabled')).toBeTruthy());

    fireEvent.click(screen.getByTestId('pof-gate-notify-enabled'));

    await waitFor(() => {
      const savePost = fetchMock.mock.calls.find(([, init]) => {
        const b = (init as RequestInit | undefined)?.body;
        return typeof b === 'string' && b.includes('"action":"save"') && b.includes('"enabled":true');
      });
      expect(savePost).toBeTruthy();
    });
  });

  it('sends a test notification via the Send test button', async () => {
    const fetchMock = mockFetchRoutes([{ match: '/api/notify/gate', response: { body: body() } }]);
    render(<GateNotifySettings />);
    await waitFor(() => expect(screen.getByTestId('pof-gate-notify-test')).toBeTruthy());

    fireEvent.click(screen.getByTestId('pof-gate-notify-test'));

    await waitFor(() => {
      const testPost = fetchMock.mock.calls.find(([, init]) => {
        const b = (init as RequestInit | undefined)?.body;
        return typeof b === 'string' && b.includes('"action":"test"');
      });
      expect(testPost).toBeTruthy();
    });
    // outcome surfaces in the status row
    await waitFor(() => expect(screen.getByTestId('pof-gate-notify-testmsg').textContent).toContain('sent'));
  });
});
