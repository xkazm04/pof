'use client';
import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { AudioScenePainter } from '@/components/modules/content/audio/AudioScenePainter';
import { ZonePropertyPanel, EmitterPropertyPanel } from '@/components/modules/content/audio/AudioPropertyPanel';
import { MODULE_COLORS } from '@/lib/constants';
import type { SceneDraft } from '@/components/modules/content/audio/AudioScenePainter/types';
import type { AudioSceneDocument, AudioZone } from '@/types/audio-scene';
import { useSceneBuffer, useSceneZone, useSceneEmitter } from './useSceneBuffer';

interface PainterTabProps {
  activeDoc: AudioSceneDocument;
  /**
   * The ONE write of the painter tab: the whole rebased scene. Rejects so the
   * scene buffer keeps its ops and offers a retry. Canvas gestures and panel
   * fields both reach it through the same buffer.
   */
  commitScene: (next: SceneDraft) => Promise<void>;
  setSelectedZoneId: Dispatch<SetStateAction<string | null>>;
  setSelectedEmitterId: Dispatch<SetStateAction<string | null>>;
  selectedZoneId: string | null;
  selectedEmitterId: string | null;
  handleGenerateZoneCode: (zone: AudioZone) => void;
  handleGenerateSoundscape: (zone: AudioZone) => void;
  audioCli: ReturnType<typeof useModuleCLI>;
}

export function PainterTab({
  activeDoc,
  commitScene,
  setSelectedZoneId,
  setSelectedEmitterId,
  selectedZoneId,
  selectedEmitterId,
  handleGenerateZoneCode,
  handleGenerateSoundscape,
  audioCli,
}: PainterTabProps) {
  // One edit buffer for the canvas AND the panels (see useSceneBuffer): a panel
  // write carries any buffered gesture, and the canvas redraws a panel slider
  // on the same frame. Flushed on unmount so a tab switch keeps a pending edit.
  const serverScene = useMemo<SceneDraft>(
    () => ({ zones: activeDoc.zones, emitters: activeDoc.emitters }),
    [activeDoc.zones, activeDoc.emitters],
  );
  const scene = useSceneBuffer({ base: serverScene, sceneId: activeDoc.id, write: commitScene, flushOnUnmount: true });
  const zoneRecord = useSceneZone(scene, selectedZoneId);
  const emitterRecord = useSceneEmitter(scene, selectedEmitterId);

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0">
        <AudioScenePainter
          zones={activeDoc.zones}
          emitters={activeDoc.emitters}
          buffer={scene}
          onSelectZone={(id) => { setSelectedZoneId(id); if (id) setSelectedEmitterId(null); }}
          onSelectEmitter={(id) => { setSelectedEmitterId(id); if (id) setSelectedZoneId(null); }}
          selectedZoneId={selectedZoneId}
          selectedEmitterId={selectedEmitterId}
          accentColor={MODULE_COLORS.content}
        />
      </div>

      {/* Property sidebar */}
      {(zoneRecord || emitterRecord) && (
        <div className="w-72 border-l border-border bg-surface-deep flex-shrink-0 overflow-y-auto">
          {/* Keyed by id so each record's panel state starts fresh; its edits
              live in the scene buffer, which outlives a selection change. */}
          {zoneRecord && (
            <ZonePropertyPanel
              key={zoneRecord.value.id}
              zone={zoneRecord.value}
              record={zoneRecord}
              onGenerateCode={handleGenerateZoneCode}
              onGenerateSoundscape={handleGenerateSoundscape}
              accentColor={MODULE_COLORS.content}
              isGenerating={audioCli.isRunning}
            />
          )}
          {emitterRecord && !zoneRecord && (
            <EmitterPropertyPanel
              key={emitterRecord.value.id}
              emitter={emitterRecord.value}
              record={emitterRecord}
              accentColor={MODULE_COLORS.content}
            />
          )}
        </div>
      )}
    </div>
  );
}
