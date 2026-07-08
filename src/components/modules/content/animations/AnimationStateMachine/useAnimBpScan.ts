import { useState, useCallback, useRef, useEffect } from 'react';
import { getModuleName } from '@/lib/prompt-context';
import type { AnimBPScanResult } from '@/app/api/filesystem/scan-animbp/route';

// Owns AnimBP scan state, the scan request, and the "what changed since last
// scan" diff tracking (new states + modified transitions, auto-cleared after 5s).
export function useAnimBpScan(projectPath: string | null, projectName: string | null) {
  const [scanResult, setScanResult] = useState<AnimBPScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Diff tracking
  const prevScanRef = useRef<AnimBPScanResult | null>(null);
  const [newStateIds, setNewStateIds] = useState<Set<string>>(new Set());
  const [modifiedTransitions, setModifiedTransitions] = useState<Set<string>>(new Set());
  const diffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScan = useCallback(async () => {
    if (!projectPath || !projectName || isScanning) return;
    setIsScanning(true);
    setScanError(null);

    try {
      const moduleName = getModuleName(projectName);
      const res = await fetch('/api/filesystem/scan-animbp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, moduleName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Scan failed' }));
        setScanError(err.error ?? `Scan failed (${res.status})`);
        return;
      }
      const data: AnimBPScanResult = await res.json();

      // Compute diff against previous scan
      if (prevScanRef.current && prevScanRef.current.states.length > 0) {
        const oldNames = new Set(prevScanRef.current.states.map((s) => s.name));
        const newIds = new Set<string>();
        for (const s of data.states) {
          if (!oldNames.has(s.name)) newIds.add(`scanned-${s.name}`);
        }
        setNewStateIds(newIds);

        const oldTransKeys = new Set(prevScanRef.current.transitions.map((t) => `${t.from}->${t.to}`));
        const modifiedKeys = new Set<string>();
        for (const t of data.transitions) {
          const key = `scanned-${t.from}->scanned-${t.to}`;
          if (!oldTransKeys.has(`${t.from}->${t.to}`)) modifiedKeys.add(key);
        }
        setModifiedTransitions(modifiedKeys);

        // Clear diff animations after 5 seconds
        if (diffTimerRef.current) clearTimeout(diffTimerRef.current);
        diffTimerRef.current = setTimeout(() => {
          setNewStateIds(new Set());
          setModifiedTransitions(new Set());
        }, 5000);
      }

      prevScanRef.current = data;
      setScanResult(data);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan');
    } finally {
      setIsScanning(false);
    }
  }, [projectPath, projectName, isScanning]);

  // Cleanup diff timer
  useEffect(() => {
    return () => {
      if (diffTimerRef.current) clearTimeout(diffTimerRef.current);
    };
  }, []);

  return { scanResult, isScanning, scanError, newStateIds, modifiedTransitions, handleScan };
}
