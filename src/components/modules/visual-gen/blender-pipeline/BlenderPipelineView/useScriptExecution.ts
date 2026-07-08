'use client';

import { useState, useCallback } from 'react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { executeViaMCP } from '@/components/modules/visual-gen/blender-pipeline/ScriptRunner';

/* ─── Shared execution hook ─────────────────────────────────────────────── */

export function useScriptExecution() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connected = useBlenderMCPStore((s) => s.connection.connected);

  const execute = useCallback(
    async (scriptName: string, code: string) => {
      setIsRunning(true);
      setResult(null);
      setError(null);

      const res = await executeViaMCP(scriptName, code);

      if (res.ok) {
        setResult(res.data.output);
      } else {
        setError(res.error);
      }
      setIsRunning(false);
    },
    [],
  );

  return { isRunning, result, error, connected, execute };
}
