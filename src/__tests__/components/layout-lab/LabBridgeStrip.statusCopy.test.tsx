/**
 * LabBridgeStrip overrides the shared indicator's label, and its override only knew two
 * cases: connected-with-plugin-info, and "UE bridge · disconnected" for EVERYTHING else.
 * So a bridge that was connecting, reconnecting or in error — or connected before the
 * plugin info arrived — told the header it was disconnected, in that state's colour.
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

const stripText = () => screen.getByRole('status').textContent ?? '';

describe('LabBridgeStrip says the state the bridge is in', () => {
  it.each([
    ['connecting', /connecting/i],
    ['reconnecting', /reconnecting/i],
    ['error', /error/i],
    ['disconnected', /disconnected/i],
  ] as const)('%s', (status, word) => {
    usePofBridgeStore.setState({ connectionStatus: status, pluginInfo: null });
    render(<LabBridgeStrip t={LIGHT} />);
    expect(stripText()).toMatch(word);
    if (status !== 'disconnected') expect(stripText()).not.toMatch(/disconnected/i);
  });

  it('connected before plugin info arrives does not read as disconnected', () => {
    usePofBridgeStore.setState({ connectionStatus: 'connected', pluginInfo: null });
    render(<LabBridgeStrip t={LIGHT} />);
    expect(stripText()).toMatch(/connected/i);
    expect(stripText()).not.toMatch(/disconnected/i);
  });

});
