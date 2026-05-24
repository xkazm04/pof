import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BridgeStatusCard } from '@/components/ecw/live/BridgeStatusCard';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';

describe('BridgeStatusCard', () => {
  beforeEach(() => {
    usePofBridgeStore.setState({
      connectionStatus: 'disconnected',
      pluginInfo: null,
      manifest: null,
      manifestChecksum: null,
      lastManifestUpdate: null,
      error: null,
    });
  });
  afterEach(cleanup);

  it('renders the card title', () => {
    render(<BridgeStatusCard />);
    expect(screen.getByRole('heading', { level: 2, name: /^Bridge$/ })).toBeTruthy();
  });

  it('shows disconnected state by default', () => {
    render(<BridgeStatusCard />);
    expect(screen.getByText(/disconnected/i)).toBeTruthy();
  });

  it('shows plugin version + project when connected', () => {
    usePofBridgeStore.setState({
      connectionStatus: 'connected',
      pluginInfo: {
        pluginVersion: '1.4.0',
        engineVersion: '5.7.0',
        projectName: 'PoF',
        projectRoot: 'C:/PoF',
        editorState: 'idle',
        pieRunning: false,
        liveCodingEnabled: true,
        manifestReady: true,
        manifestAssetCount: 1247,
        manifestLastUpdated: '2026-05-24T12:39:00Z',
        uptimeSeconds: 3600,
        port: 30040,
      },
    });
    render(<BridgeStatusCard />);
    expect(screen.getByText(/1.4.0/)).toBeTruthy();
    expect(screen.getByText(/PoF/)).toBeTruthy();
    expect(screen.getByText(/1,?247 assets/)).toBeTruthy();
  });
});
