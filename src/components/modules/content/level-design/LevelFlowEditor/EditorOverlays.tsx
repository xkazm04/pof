import { Plus, Unlink, Monitor } from 'lucide-react';
import { STATUS_ERROR } from '@/lib/chart-colors';

interface EditorOverlaysProps {
  readOnly: boolean;
  accentColor: string;
  addRoom: () => void;
  handleBlockoutInBlender: () => void;
  blenderConnected: boolean;
  blenderExporting: boolean;
  connectingFrom: string | null;
  setConnectingFrom: (v: string | null) => void;
  roomsLength: number;
  connectionsLength: number;
  blenderResult: { message: string; isError: boolean } | null;
}

export function EditorOverlays({
  readOnly,
  accentColor,
  addRoom,
  handleBlockoutInBlender,
  blenderConnected,
  blenderExporting,
  connectingFrom,
  setConnectingFrom,
  roomsLength,
  connectionsLength,
  blenderResult,
}: EditorOverlaysProps) {
  return (
    <>
      {/* Toolbar */}
      {!readOnly && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <button
            onClick={addRoom}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg"
            style={{
              backgroundColor: `${accentColor}20`,
              color: accentColor,
              border: `1px solid ${accentColor}50`,
              boxShadow: `0 0 15px ${accentColor}30, inset 0 0 10px ${accentColor}15`,
            }}
          >
            <Plus className="w-4 h-4" />
            Add Room
          </button>
          <button
            onClick={handleBlockoutInBlender}
            disabled={!blenderConnected || blenderExporting || roomsLength === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg disabled:opacity-40"
            style={{
              backgroundColor: 'rgba(16,185,129,0.12)',
              color: 'rgb(52,211,153)',
              border: '1px solid rgba(16,185,129,0.4)',
              boxShadow: '0 0 15px rgba(16,185,129,0.2), inset 0 0 10px rgba(16,185,129,0.1)',
            }}
            title={!blenderConnected ? 'Connect to Blender first' : 'Create 3D blockout in Blender'}
          >
            {blenderExporting ? (
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <Monitor className="w-4 h-4" />
            )}
            {blenderExporting ? 'Exporting...' : 'Blockout in Blender'}
          </button>
          {connectingFrom && (
            <button
              onClick={() => setConnectingFrom(null)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all animate-pulse"
              style={{
                backgroundColor: `${STATUS_ERROR}20`,
                color: STATUS_ERROR,
                border: `1px solid ${STATUS_ERROR}50`,
                boxShadow: `0 0 15px ${STATUS_ERROR}40, inset 0 0 10px ${STATUS_ERROR}20`,
              }}
            >
              <Unlink className="w-4 h-4" />
              Cancel Link
            </button>
          )}
        </div>
      )}

      {/* Room count badge */}
      <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-lg border bg-surface-deep/80 backdrop-blur-sm border-violet-900/40 text-xs uppercase font-mono font-bold tracking-widest text-violet-300/80 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
        {roomsLength} NODES <span className="mx-1 text-violet-500/50">|</span> {connectionsLength} LINKS
      </div>

      {/* Blender blockout result */}
      {blenderResult && (
        <div className={`absolute bottom-4 left-4 right-4 z-10 text-xs font-mono px-3 py-2 rounded-lg border backdrop-blur-sm ${blenderResult.isError ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
          {blenderResult.message}
        </div>
      )}
    </>
  );
}
