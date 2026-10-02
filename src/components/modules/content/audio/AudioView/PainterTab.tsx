'use client';
import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { AudioScenePainter } from '@/components/modules/content/audio/AudioScenePainter';
import { ZonePropertyPanel, EmitterPropertyPanel } from '@/components/modules/content/audio/AudioPropertyPanel';
import { MODULE_COLORS } from '@/lib/constants';
import type { SceneDraft } from '@/components/modules/content/audio/AudioScenePainter/types';
import type { AudioSceneDocument, AudioZone } from '@/types/audio-scene';
import { useSceneBuffer, useSceneZone, useSceneEmitter, type SceneBuffer } from './useSceneBuffer';

interface PainterTabProps {
  activeDoc: AudioSceneDocument;
  /**
   * The AudioView session's scene buffer (`useSceneSession`), shared with the
   * other tabs so a tab switch keeps every buffered op. Without it the tab
   * builds its own buffer over `commitScene` (tests, previews).
   */
  buffer?: SceneBuffer;
  /**
   * The self-owned buffer's write: the whole rebased scene. Rejects so the
   * buffer keeps its ops and offers a retry. Unused when `buffer` is given.
   */
  commitScene?: (next: SceneDraft) => Promise<void>;
  setSelectedZoneId: Dispatch<SetStateAction<string | null>>;
  setSelectedEmitterId: Dispatch<SetStateAction<string | null>>;
  selectedZoneId: string | null;
  selectedEmitterId: string | null;
  handleGenerateZoneCode: (zone: AudioZone) => void;
  handleGenerateSoundscape: (zone: AudioZone) => void;
  audioCli: ReturnType<typeof useModuleCLI>;
}

const noWrite = async () => {};

export function PainterTab({
  activeDoc,
  buffer,
  commitScene = noWrite,
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
  // on the same frame. With a session `buffer` the self-owned one stays inert
  // (no base); without it, it is flushed on unmount so a tab switch keeps an edit.
  const serverScene = useMemo<SceneDraft>(
    () => ({ zones: activeDoc.zones, emitters: activeDoc.emitters }),
    [activeDoc.zones, activeDoc.emitters],
  );
  const ownBuffer = useSceneBuffer({
    base: buffer ? null : serverScene,
    sceneId: activeDoc.id,
    write: commitScene,
    flushOnUnmount: !buffer,
  });
  const scene = buffer ?? ownBuffer;
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
