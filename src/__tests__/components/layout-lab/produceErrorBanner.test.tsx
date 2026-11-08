import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

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
