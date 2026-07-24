'use client';

import type { SimulationSandboxProps } from './types';
import { useSimulationSandbox } from './useSimulationSandbox';
import { ControlsBar } from './ControlsBar';
import { QueueAndOverrides } from './QueueAndOverrides';
import { SimGraphs } from './SimGraphs';

export function SimulationSandbox({ attributes, effects, relationships, accent }: SimulationSandboxProps) {
  const {
    queue,
    overrides, setOverrides,
    simDuration, setSimDuration,
    snapshots,
    playbackIdx, setPlaybackIdx,
    isPlaying, setIsPlaying,
    expandedAttrs, setExpandedAttrs,
    trackableAttrs,
    trackedAttrNames,
    runSim,
    addQueueItem,
    removeQueueItem,
    updateQueueItem,
    currentSnap,
    currentTime,
    eventLog,
    sparklineData,
    toggleTrack,
  } = useSimulationSandbox({ attributes, effects, relationships });

  return (
    <div className="space-y-3">
      {/* ── Controls Bar ──────────────────────────────────────────────── */}
      <ControlsBar
        runSim={runSim}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        playbackIdx={playbackIdx}
        setPlaybackIdx={setPlaybackIdx}
        snapshots={snapshots}
        simDuration={simDuration}
        setSimDuration={setSimDuration}
        currentSnap={currentSnap}
        currentTime={currentTime}
        accent={accent}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* ── Left: Effect Queue + Attribute Overrides ────────────────── */}
        <QueueAndOverrides
          accent={accent}
          effects={effects}
          attributes={attributes}
          simDuration={simDuration}
          queue={queue}
          addQueueItem={addQueueItem}
          removeQueueItem={removeQueueItem}
          updateQueueItem={updateQueueItem}
          expandedAttrs={expandedAttrs}
          setExpandedAttrs={setExpandedAttrs}
          overrides={overrides}
          setOverrides={setOverrides}
        />

        {/* ── Center: Sparkline Graphs ────────────────────────────────── */}
        <SimGraphs
          accent={accent}
          attributes={attributes}
          trackableAttrs={trackableAttrs}
          trackedAttrNames={trackedAttrNames}
          toggleTrack={toggleTrack}
          snapshots={snapshots}
          sparklineData={sparklineData}
          playbackIdx={playbackIdx}
          eventLog={eventLog}
          currentSnap={currentSnap}
          overrides={overrides}
        />
      </div>
    </div>
  );
}
