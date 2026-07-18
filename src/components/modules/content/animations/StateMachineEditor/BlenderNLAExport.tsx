'use client';

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { exportStatesToBlenderNLA } from '../shared/state-machine-shared';
import type { EditorState } from './types';

// ── Blender NLA Export ──

export function BlenderNLAExport({ states }: { states: EditorState[] }) {
  const { connection } = useBlenderMCPStore();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    await exportStatesToBlenderNLA(
      states.map((s) => ({ name: s.name, type: s.stateType })),
    );
    setIsExporting(false);
  };

  if (!connection.connected) return null;

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || states.length === 0}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-border/40 text-text-muted hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
      title={states.length === 0 ? 'Add at least one state to export NLA tracks' : 'Export state machine as Blender NLA tracks'}
    >
      <Layers className="w-3 h-3" />
      {isExporting ? 'Exporting...' : 'NLA Export'}
    </button>
  );
}
