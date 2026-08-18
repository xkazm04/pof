'use client';
import type { Dispatch, SetStateAction } from 'react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { AudioScenePainter } from '@/components/modules/content/audio/AudioScenePainter';
import { ZonePropertyPanel, EmitterPropertyPanel } from '@/components/modules/content/audio/AudioPropertyPanel';
import { MODULE_COLORS } from '@/lib/constants';
import type { SceneDraft } from '@/components/modules/content/audio/AudioScenePainter/types';
import type { AudioSceneDocument, AudioZone, SoundEmitter } from '@/types/audio-scene';

interface PainterTabProps {
  activeDoc: AudioSceneDocument;
  /** Single write for a whole painter gesture; rejects so the painter keeps its buffer. */
  commitScene: (next: SceneDraft) => Promise<void>;
  commitZones: (zones: AudioZone[]) => Promise<void>;
  commitEmitters: (emitters: SoundEmitter[]) => Promise<void>;
  setSelectedZoneId: Dispatch<SetStateAction<string | null>>;
  setSelectedEmitterId: Dispatch<SetStateAction<string | null>>;
  selectedZoneId: string | null;
  selectedEmitterId: string | null;
  selectedZone: AudioZone | null;
  selectedEmitter: SoundEmitter | null;
  handleZoneUpdate: (updatedZone: AudioZone) => void;
  handleGenerateZoneCode: (zone: AudioZone) => void;
  handleGenerateSoundscape: (zone: AudioZone) => void;
  handleEmitterUpdate: (updatedEmitter: SoundEmitter) => void;
  audioCli: ReturnType<typeof useModuleCLI>;
}

export function PainterTab({
  activeDoc,
  commitScene,
  commitZones,
  commitEmitters,
  setSelectedZoneId,
  setSelectedEmitterId,
  selectedZoneId,
  selectedEmitterId,
  selectedZone,
  selectedEmitter,
  handleZoneUpdate,
  handleGenerateZoneCode,
  handleGenerateSoundscape,
  handleEmitterUpdate,
  audioCli,
}: PainterTabProps) {
  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0">
        <AudioScenePainter
          zones={activeDoc.zones}
          emitters={activeDoc.emitters}
          onUpdateZones={commitZones}
          onUpdateEmitters={commitEmitters}
          onCommit={commitScene}
          onSelectZone={(id) => { setSelectedZoneId(id); if (id) setSelectedEmitterId(null); }}
          onSelectEmitter={(id) => { setSelectedEmitterId(id); if (id) setSelectedZoneId(null); }}
          selectedZoneId={selectedZoneId}
          selectedEmitterId={selectedEmitterId}
          accentColor={MODULE_COLORS.content}
        />
      </div>

      {/* Property sidebar */}
      {(selectedZone || selectedEmitter) && (
        <div className="w-72 border-l border-border bg-surface-deep flex-shrink-0 overflow-y-auto">
          {selectedZone && (
            <ZonePropertyPanel
              zone={selectedZone}
              onUpdate={handleZoneUpdate}
              onGenerateCode={handleGenerateZoneCode}
              onGenerateSoundscape={handleGenerateSoundscape}
              accentColor={MODULE_COLORS.content}
              isGenerating={audioCli.isRunning}
            />
          )}
          {selectedEmitter && !selectedZone && (
            <EmitterPropertyPanel
              emitter={selectedEmitter}
              onUpdate={handleEmitterUpdate}
              accentColor={MODULE_COLORS.content}
            />
          )}
        </div>
      )}
    </div>
  );
}
