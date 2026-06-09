import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { McpErrorBanner } from '@/components/blender-mcp/McpErrorBanner';

afterEach(cleanup);

describe('McpErrorBanner', () => {
  it('renders nothing while show is false', () => {
    render(
      <McpErrorBanner show={false} motionKey="x">
        <span>Boom</span>
      </McpErrorBanner>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces the banner via role="alert" + aria-live="polite" and shows the message', () => {
    render(
      <McpErrorBanner show motionKey="x">
        <span>Bridge unreachable</span>
      </McpErrorBanner>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('polite');
    expect(alert.textContent).toMatch(/Bridge unreachable/);
    // Decorative AlertTriangle icon is present and hidden from screen readers.
    const icon = alert.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeTruthy();
  });

  it('renders an optional trailing action alongside the message', () => {
    render(
      <McpErrorBanner
        show
        motionKey="x"
        action={<button type="button">Troubleshoot</button>}
      >
        <span>Something failed</span>
      </McpErrorBanner>,
    );
    expect(screen.getByRole('button', { name: /troubleshoot/i })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/Something failed/);
  });
});
