import { ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';
import { STATUS_ERROR, STATUS_WARNING, STATUS_SUCCESS, STATUS_SUBDUED } from '@/lib/chart-colors';
import {
  fixToOp, type PreflightFinding, type StreamingPreflight, type StreamingResidency,
} from '@/lib/level-design/streaming-preflight';
import type { StreamingZone, StreamingOp } from './types';

interface PreflightPanelProps {
  preflight: StreamingPreflight;
  residency: StreamingResidency;
  zones: StreamingZone[];
  selectedZoneId: string | null;
  dispatch: (op: StreamingOp) => void;
}

/** Blocking first, then design errors, then warnings, then rules that could not run. */
function rank(f: PreflightFinding): number {
  if (f.status === 'not-evaluated') return 3;
  if (f.blocksGenerate) return 0;
  return f.severity === 'error' ? 1 : 2;
}

function chip(f: PreflightFinding): { label: string; color: string } {
  if (f.status === 'not-evaluated') return { label: 'not evaluated', color: STATUS_SUBDUED };
  if (f.blocksGenerate) return { label: 'will not compile', color: STATUS_ERROR };
  return f.severity === 'error' ? { label: 'error', color: STATUS_ERROR } : { label: 'hitch risk', color: STATUS_WARNING };
}

export function PreflightPanel({ preflight, residency, zones, selectedZoneId, dispatch }: PreflightPanelProps) {
  const findings = [...preflight.findings].sort((a, b) => rank(a) - rank(b));
  const nameOf = (id: string) => zones.find((z) => z.id === id)?.name ?? id;
  const { peak } = residency;
  const selectedResident = selectedZoneId ? residency.byZone[selectedZoneId] : undefined;
  const clean = findings.length === 0;

  return (
    <div data-testid="streaming-preflight" className="bg-[#03030a] rounded-xl border border-violet-900/30 p-4 space-y-2 text-xs">
      <div className="flex items-center gap-2 font-mono uppercase tracking-widest text-xs text-violet-300">
        {clean
          ? <ShieldCheck className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />
          : <ShieldAlert className="w-3.5 h-3.5" style={{ color: preflight.blocksGenerate ? STATUS_ERROR : STATUS_WARNING }} />}
        Preflight
        <span className="ml-auto text-violet-500">{findings.length} finding{findings.length === 1 ? '' : 's'}</span>
      </div>

      {clean && (
        <p className="text-text-muted">Identifiers compile, every zone is reachable, every seamless crossing is preloaded.</p>
      )}

      <ul className="space-y-1.5">
        {findings.map((f, i) => {
          const c = chip(f);
          return (
            <li key={`${f.rule}-${f.transitionId ?? f.zoneIds.join('+')}-${i}`} className="rounded-md border border-violet-900/30 p-2 space-y-1">
              <div className="flex items-start gap-2">
                <span
                  className="shrink-0 px-1.5 rounded text-xs font-mono uppercase"
                  style={{ color: c.color, border: `1px solid ${c.color}50` }}
                >
                  {c.label}
                </span>
                <button
                  type="button"
                  className="text-left text-text hover:underline disabled:no-underline"
                  disabled={f.zoneIds.length === 0}
                  onClick={() => dispatch({ type: 'select', zoneId: f.zoneIds[f.zoneIds.length - 1] })}
                >
                  {f.message}
                </button>
              </div>
              {f.fix && (
                <button
                  type="button"
                  onClick={() => dispatch(fixToOp(f.fix!))}
                  className="flex items-center gap-1 px-2 py-0.5 rounded border border-violet-700/50 text-violet-300 hover:bg-violet-900/30"
                >
                  <Wrench className="w-3 h-3" />
                  Fix: {f.fixLabel}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {peak && (
        <p className="text-text-muted font-mono">
          Peak residency {peak.count}/{peak.of} at {nameOf(peak.zoneId)}
          {peak.count === peak.of && peak.of > 1 && ' — every zone resident, streaming saves nothing there'}
        </p>
      )}
      {selectedZoneId && selectedResident && (
        <p className="text-text-muted font-mono">
          Resident from {nameOf(selectedZoneId)}: {selectedResident.length}/{zones.length} (outlined on the grid)
        </p>
      )}
    </div>
  );
}
