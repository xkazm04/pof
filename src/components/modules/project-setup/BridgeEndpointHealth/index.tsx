'use client';

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ErrorBanner } from '../ErrorBanner';
import { SUBSYSTEMS } from './constants';
import { useBridgeEndpointHealth } from './useBridgeEndpointHealth';
import { HealthHeader } from './HealthHeader';
import { ConnectionSettings } from './ConnectionSettings';
import { SubsystemGroup } from './SubsystemGroup';

export function BridgeEndpointHealth() {
  const {
    host, rcPort, setHost, setRcPort, pofPort, setPofPort, connectionStatus,
    collapsed, health, latencyHistory, pinging, showSettings, setShowSettings,
    toggleCollapse, pingAll,
    isDisconnected, healthyCount, checkedCount,
  } = useBridgeEndpointHealth();

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="bridge-endpoint-health-panel" role="region" aria-label="Bridge Endpoints">
      {/* Header */}
      <HealthHeader
        connectionStatus={connectionStatus}
        pofPort={pofPort}
        rcPort={rcPort}
        checkedCount={checkedCount}
        healthyCount={healthyCount}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        pingAll={pingAll}
        pinging={pinging}
        isDisconnected={isDisconnected}
      />

      {/* Connection Settings */}
      {showSettings && (
        <ConnectionSettings
          host={host}
          setHost={setHost}
          pofPort={pofPort}
          setPofPort={setPofPort}
          rcPort={rcPort}
          setRcPort={setRcPort}
        />
      )}

      {/* Disconnected banner */}
      {isDisconnected && (
        <ErrorBanner message="Bridge not connected — connect to ping endpoints" className="mx-4 my-2" />
      )}

      {/* Subsystem groups */}
      <div className="divide-y divide-border/20">
        {SUBSYSTEMS.map((subsystem) => (
          <SubsystemGroup
            key={subsystem.id}
            subsystem={subsystem}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            health={health}
            latencyHistory={latencyHistory}
          />
        ))}
      </div>
    </SurfaceCard>
  );
}
