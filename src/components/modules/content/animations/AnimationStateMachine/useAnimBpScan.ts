import { useState, useCallback, useRef, useEffect } from 'react';
import { getModuleName } from '@/lib/prompt-context';
import { tryApiFetch } from '@/lib/api-utils';
import type { AnimBPScanResult } from '@/app/api/filesystem/scan-animbp/route';

// `POST /api/filesystem/scan-animbp` answers with the standard `{success,data}`
// envelope (`apiSuccess(result)`), so the body is NOT the scan result — reading
// `body.states` yields `undefined` and every consumer that dereferences
// `.length` throws on the render after a *successful* scan. `tryApiFetch`
// unwraps the envelope and turns every failure (error envelope, non-2xx,
// unparseable body, network fault) into a `Result` we can report as text.
//
// Unwrapping is not enough on its own: a 200 whose `data` is the wrong shape
// would fail exactly the same way one render later, far from the fetch. So the
// payload is validated at the boundary and a bad shape becomes a REPORTED scan
// error, never a stored half-result.

/** The fields consumers dereference without a guard — all must really be arrays. */
function isScanResult(value: unknown): value is AnimBPScanResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<AnimBPScanResult>;
  return Array.isArray(v.states) && Array.isArray(v.transitions);
}

/** Fill the display-only arrays an older/partial payload may omit. */
function normalizeScanResult(data: AnimBPScanResult): AnimBPScanResult {
  return {
    ...data,
    montageRefs: Array.isArray(data.montageRefs) ? data.montageRefs : [],
    animVariables: Array.isArray(data.animVariables) ? data.animVariables : [],
  };
}

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
      const result = await tryApiFetch<AnimBPScanResult>('/api/filesystem/scan-animbp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, moduleName }),
      });
      if (!result.ok) {
        // An error envelope with no message would otherwise render the literal
        // string "undefined" as the reason.
        setScanError(result.error || 'Scan failed — the server reported no reason');
        return;
      }
      if (!isScanResult(result.data)) {
        setScanError('Scan returned an unreadable result (no states/transitions in the response)');
        return;
      }
      const data = normalizeScanResult(result.data);

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
