import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CodegenStatusLine } from '@/components/modules/core-engine/sub_ability/_shared/CodegenStatusLine';
import type { CodegenStatus } from '@/components/modules/core-engine/sub_ability/_shared/useCodegenStatus';
import type { CodegenReport } from '@/lib/ability/spec';

afterEach(cleanup);

const NOOP = () => {};

function status(over: Partial<CodegenStatus>): CodegenStatus {
  return { state: 'idle', report: null, reason: null, markDispatched: NOOP, onCliComplete: NOOP, ...over };
}

const CONFIRMED: CodegenReport = {
  status: 'confirmed',
  filesWritten: ['GE_Gen_Fireball_FireStrike.h', 'GA_Gen_Fireball.cpp'],
  buildOk: true,
  seedRan: true,
  dataTableRows: 2,
  missingTags: [],
  reportedAt: '2026-07-29T00:00:00.000Z',
};

describe('CodegenStatusLine', () => {
  it('renders nothing before a dispatch', () => {
    const { container } = render(<CodegenStatusLine status={status({})} />);
    expect(container.textContent).toBe('');
  });

  it('shows an in-flight dispatch as awaiting the report (not as success)', () => {
    const { container } = render(<CodegenStatusLine status={status({ state: 'dispatched' })} />);
    const el = container.querySelector('[data-codegen-state="dispatched"]');
    expect(el).not.toBeNull();
    expect(el?.textContent).toMatch(/waiting for the agent/i);
  });

  it('reports the confirmed files / build / seeded rows', () => {
    const { container } = render(
      <CodegenStatusLine status={status({ state: 'confirmed', report: CONFIRMED })} />,
    );
    const el = container.querySelector('[data-codegen-state="confirmed"]');
    expect(el?.textContent).toContain('2 files written');
    expect(el?.textContent).toContain('2 rows');
  });

  it('reports a failure WITH its reason', () => {
    const { container } = render(
      <CodegenStatusLine status={status({ state: 'failed', reason: 'the seeder did not run' })} />,
    );
    const el = container.querySelector('[data-codegen-state="failed"]');
    expect(el?.textContent).toContain('not confirmed');
    expect(el?.textContent).toContain('the seeder did not run');
  });
});
