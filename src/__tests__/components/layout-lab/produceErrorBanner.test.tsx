import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm', variable: '--m' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { ProduceErrorBanner } from '@/components/layout-lab/ProduceErrorBanner';
import { LIGHT } from '@/components/layout-lab/theme';

afterEach(cleanup);

describe('ProduceErrorBanner live region', () => {
  it('keeps the Dismiss control outside the alert (the announcement is the message only)', () => {
    const { container } = render(
      <ProduceErrorBanner t={LIGHT} step="Economy" error="boom" hasContent={false} onDismiss={() => {}} />,
    );
    const live = container.querySelectorAll('[role="alert"]');
    expect(live.length).toBe(1);
    expect(live[0].textContent).toContain('boom');
    expect(container.querySelectorAll('[role="alert"] button, [role="alert"] input').length).toBe(0);
    expect(container.querySelector('[data-testid="produce-error-dismiss"]')).not.toBeNull();
  });
});

describe('ProduceErrorBanner survival sentences', () => {
  const mount = (hasContent: boolean, onDismiss = vi.fn()) => ({
    onDismiss,
    ...render(<ProduceErrorBanner t={LIGHT} step="Economy" error="provider timed out" hasContent={hasContent} onDismiss={onDismiss} />),
  });

  it('says earlier content survived when hasContent, and never claims nothing was produced', () => {
    const { getByTestId } = mount(true);
    const text = getByTestId('produce-error-banner').textContent ?? '';
    expect(getByTestId('produce-error-reason').textContent).toBe('provider timed out');
    expect(text).toContain('the content from the previous successful run is still here');
    expect(text).not.toContain('nothing was produced for this step');
  });

  it('says nothing was produced when there is no content, and never claims content survived', () => {
    const { getByTestId } = mount(false);
    const text = getByTestId('produce-error-banner').textContent ?? '';
    expect(text).toContain('nothing was produced for this step');
    expect(text).not.toContain('previous successful run');
  });

  it('Dismiss calls onDismiss', () => {
    const { getByTestId, onDismiss } = mount(false);
    fireEvent.click(getByTestId('produce-error-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
