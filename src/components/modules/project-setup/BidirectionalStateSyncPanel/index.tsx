'use client';

/**
 * BidirectionalStateSyncPanel — Full bidirectional UE5 editor control surface.
 *
 * Beyond the read-only LiveStateSyncPanel, this panel provides:
 *   - Property write-back: edit watched property values and push to UE5
 *   - PIE control: play/pause/stop from the web app
 *   - Viewport teleport: set camera position/rotation/FOV
 *   - Actor selection push: select actors in UE5 from the web app
 *   - Sync log: live message log of all inbound/outbound WS traffic
 *   - Conflict detection: highlights when both sides edit the same property
 */

import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useBidirectionalStateSyncPanel } from './useBidirectionalStateSyncPanel';
import { PanelHeader } from './PanelHeader';
import { OfflineState } from './OfflineState';
import { PieControlSection } from './PieControlSection';
import { PropertyWriteSection } from './PropertyWriteSection';
import { ViewportTeleportSection } from './ViewportTeleportSection';
import { ConflictSection } from './ConflictSection';
import { SyncLogSection } from './SyncLogSection';

// ── Main component ─────────────────────────────────────────────────────────

export function BidirectionalStateSyncPanel() {
  const s = useBidirectionalStateSyncPanel();

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="bidirectional-state-sync-panel" role="region" aria-label="Bidirectional State Sync">
      {/* ── Header ───────────────────────────────────────────────── */}
      <PanelHeader
        isLive={s.isLive}
        conflicts={s.conflicts}
        outboundCount={s.outboundCount}
        inboundCount={s.inboundCount}
        frameRate={s.frameRate}
        connectWs={s.connectWs}
        disconnectWs={s.disconnectWs}
      />

      {/* ── Offline state ─────────────────────────────────────────── */}
      {!s.isLive && <OfflineState autoSync={s.autoSync} />}

      {/* ── Live sections ─────────────────────────────────────────── */}
      {s.isLive && (
        <div className="divide-y divide-border/20">

          {/* ── PIE Control ───────────────────────────────────────── */}
          <PieControlSection
            showPieControl={s.showPieControl}
            setShowPieControl={s.setShowPieControl}
            snapshot={s.snapshot}
            handlePIE={s.handlePIE}
            requestSnapshot={s.requestSnapshot}
          />

          {/* ── Property Write-Back ───────────────────────────────── */}
          <PropertyWriteSection
            showPropertyWrite={s.showPropertyWrite}
            setShowPropertyWrite={s.setShowPropertyWrite}
            watchEntries={s.watchEntries}
            handleWatchedPush={s.handleWatchedPush}
            propEdit={s.propEdit}
            setPropEdit={s.setPropEdit}
            handleDirectPropertyPush={s.handleDirectPropertyPush}
          />

          {/* ── Viewport Teleport ─────────────────────────────────── */}
          <ViewportTeleportSection
            showViewportTeleport={s.showViewportTeleport}
            setShowViewportTeleport={s.setShowViewportTeleport}
            viewTarget={s.viewTarget}
            setViewTarget={s.setViewTarget}
            handleViewportPush={s.handleViewportPush}
            handleCopyFromSnapshot={s.handleCopyFromSnapshot}
            snapshot={s.snapshot}
          />

          {/* ── Conflict Detection ────────────────────────────────── */}
          {s.conflicts.length > 0 && (
            <ConflictSection
              showConflicts={s.showConflicts}
              setShowConflicts={s.setShowConflicts}
              conflicts={s.conflicts}
            />
          )}

          {/* ── Sync Log ──────────────────────────────────────────── */}
          <SyncLogSection
            showLog={s.showLog}
            setShowLog={s.setShowLog}
            syncLog={s.syncLog}
            setSyncLog={s.setSyncLog}
            logFilter={s.logFilter}
            setLogFilter={s.setLogFilter}
            filteredLog={s.filteredLog}
            logEndRef={s.logEndRef}
          />
        </div>
      )}
    </SurfaceCard>
  );
}
