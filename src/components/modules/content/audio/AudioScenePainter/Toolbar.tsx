import { Plus, Volume2, Radio } from 'lucide-react';
import { ToolBtn } from './ToolBtn';
import type { PaintMode } from './types';

export function Toolbar({ paintMode, setPaintMode }: {
  paintMode: PaintMode;
  setPaintMode: (mode: PaintMode) => void;
}) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <div className="bg-surface border border-border p-1.5 rounded-xl backdrop-blur-md flex items-center gap-1">
        <ToolBtn
          active={paintMode === 'select'}
          onClick={() => setPaintMode('select')}
          label="SELECT"
        />
        <div className="w-px h-6 bg-border mx-1" />
        <ToolBtn
          active={paintMode === 'zone-rect'}
          onClick={() => setPaintMode('zone-rect')}
          label="VOL_RECT"
          icon={<Volume2 className="w-3.5 h-3.5" />}
        />
        <ToolBtn
          active={paintMode === 'zone-circle'}
          onClick={() => setPaintMode('zone-circle')}
          label="VOL_RADIAL"
          icon={<Radio className="w-3.5 h-3.5" />}
        />
        <div className="w-px h-6 bg-border mx-1" />
        <ToolBtn
          active={paintMode === 'emitter'}
          onClick={() => setPaintMode('emitter')}
          label="EMITTER"
          icon={<Plus className="w-3.5 h-3.5" />}
        />
      </div>
    </div>
  );
}
