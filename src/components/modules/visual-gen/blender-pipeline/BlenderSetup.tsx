'use client';

import { useCallback } from 'react';
import { Search, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useBlenderStore } from './useBlenderStore';

export function BlenderSetup() {
  const blenderPath = useBlenderStore((s) => s.blenderPath);
  const blenderVersion = useBlenderStore((s) => s.blenderVersion);
  const isDetecting = useBlenderStore((s) => s.isDetecting);
  const setBlenderPath = useBlenderStore((s) => s.setBlenderPath);
  const setDetecting = useBlenderStore((s) => s.setDetecting);

  const detectBlender = useCallback(async () => {
    setDetecting(true);
    try {
      const res = await fetch('/api/visual-gen/blender/detect');
      const json = await res.json();
      if (json.success && json.data?.path) {
        setBlenderPath(json.data.path, json.data.version);
      } else {
        setBlenderPath(null);
      }
    } catch {
      setBlenderPath(null);
    } finally {
      setDetecting(false);
    }
  }, [setBlenderPath, setDetecting]);

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text">Blender Installation</h3>
        <button
          onClick={detectBlender}
          disabled={isDetecting}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium
                     bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all
                     disabled:opacity-50"
        >
          {isDetecting ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {isDetecting ? 'Detecting...' : 'Auto-Detect'}
        </button>
      </div>

      {blenderPath ? (
        <div className="flex items-start gap-2 p-3 rounded bg-emerald-400/5 border border-emerald-400/20">
          <CheckCircle size={16} className="text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-emerald-400">Blender found</p>
            <p className="text-xs text-text-muted mt-0.5 font-mono break-all">{blenderPath}</p>
            {blenderVersion && (
              <p className="text-xs text-text-muted mt-0.5">Version: {blenderVersion}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-3 rounded bg-amber-400/5 border border-amber-400/20">
          <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-400">Blender not detected</p>
            <p className="text-xs text-text-muted mt-0.5">
              Install Blender 3.0+ from blender.org, then click Auto-Detect.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
