/**
 * The strip's status text sits inside a button whose aria-label is
 * "Open Bridge Doctor diagnostics". An explicit aria-label REPLACES the descendant text,
 * so assistive tech heard the button's purpose and never the bridge state it displays.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'm', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/components/bridge-doctor/BridgeDoctor', () => ({ BridgeDoctor: () => null }));

import { LabBridgeStrip } from '@/components/layout-lab/LabBridgeStrip';
import { LIGHT } from '@/components/layout-lab/theme';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';

afterEach(cleanup);

describe('LabBridgeStrip button names the bridge state', () => {
  it.each(['connected', 'connecting', 'reconnecting', 'disconnected', 'error'] as const)('%s', (status) => {
    usePofBridgeStore.setState({ connectionStatus: status, pluginInfo: null });
    render(<LabBridgeStrip t={LIGHT} />);
    const name = screen.getByRole('button').getAttribute('aria-label') ?? '';
    expect(name).toMatch(/bridge doctor/i);
    expect(name).toContain(status);
  });
});
