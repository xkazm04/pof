'use client';

import { useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, Save } from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { PromptDiffView } from '@/components/modules/evaluator/PromptDiffView';
import type { WritePlan } from '@/lib/blueprint-transpiler-write';
import {
  STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { ACCENT } from './constants';

// ─── Write to Project (dry-run diff → confirm) ──────────────────────────────

export function WriteToProjectButton({ className, header, source, projectPath, defaultModule }: {
  className: string;
  header: string;
  source: string;
  projectPath: string;
  defaultModule: string;
}) {
  const [moduleName, setModuleName] = useState(defaultModule);
  const [plan, setPlan] = useState<WritePlan | null>(null);
  // The module the open plan was diffed for. Editing the Module input lives
  // INSIDE the dry-run modal — a changed module makes the displayed diff
  // stale (it covers paths that will no longer be written), so Confirm must
  // be gated until a fresh dry-run exists.
  const [planModule, setPlanModule] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [written, setWritten] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const planStale = plan !== null && moduleName !== planModule;

  const body = (confirm?: boolean) => JSON.stringify({
    projectPath, moduleName, className, header, source, confirm,
    // The reviewed plan rides along on confirm — the server rejects the write
    // if the resolved paths or on-disk content no longer match it.
    ...(confirm && plan
      ? { approved: plan.files.map((f) => ({ relPath: f.relPath, before: f.before })) }
      : {}),
  });

  const dryRun = useCallback(async () => {
    setBusy(true); setErr(null); setWritten(null);
    try {
      const data = await apiFetch<WritePlan>('/api/blueprint-transpiler/write', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body(false),
      });
      setPlan(data);
      setPlanModule(moduleName);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Dry-run failed'); }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath, moduleName, className, header, source]);

  const confirmWrite = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const data = await apiFetch<{ written: string[] }>('/api/blueprint-transpiler/write', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body(true),
      });
      setWritten(data.written); setPlan(null); setPlanModule(null);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Write failed'); }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath, moduleName, className, header, source, plan]);

  if (!projectPath) {
    return <span className="text-2xs text-text-muted" title="Set a project path in Project Setup first">No project path</span>;
  }

  return (
    <>
      <button
        onClick={dryRun}
        disabled={busy}
        className="flex items-center gap-1 px-2 py-1 rounded text-2xs transition-colors disabled:opacity-40"
        style={{ backgroundColor: `${ACCENT}${OPACITY_15}`, color: ACCENT }}
        title="Write the header + source into the UE project (with a dry-run diff)"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Write to Project
      </button>

      {written && (
        <span className="text-2xs text-green-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Wrote {written.length} files
        </span>
      )}
      {err && (
        <span className="text-2xs text-red-400 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> {err}
        </span>
      )}

      {plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setPlan(null)}>
          <div
            className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                <Save className="w-4 h-4" style={{ color: ACCENT }} /> Write {className} to project — dry run
              </h3>
              <label className="text-2xs text-text-muted flex items-center gap-1.5">
                Module
                <input
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  className="w-28 bg-surface-deep border border-border rounded px-1.5 py-0.5 text-xs text-text font-mono"
                />
              </label>
            </div>

            <div className="space-y-3">
              {plan.files.map((f) => (
                <div key={f.path} className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-surface-deep">
                    <span className="text-2xs font-mono text-text">{f.relPath}</span>
                    <span className="text-2xs" style={{ color: f.exists ? STATUS_WARNING : STATUS_SUCCESS }}>
                      {f.exists
                        ? `overwrites existing · +${f.diff.summary.added} / -${f.diff.summary.removed}`
                        : `new file · +${f.diff.summary.added}`}
                    </span>
                  </div>
                  <div className="p-2">
                    <PromptDiffView before={f.before} after={f.after} maxHeightClass="max-h-56" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              {planStale && (
                <span className="text-2xs mr-auto" style={{ color: STATUS_WARNING }}>
                  Module changed — this diff covers Source/{planModule}/, not Source/{moduleName}/. Re-run the dry run.
                </span>
              )}
              <button onClick={() => { setPlan(null); setPlanModule(null); }} className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors">
                Cancel
              </button>
              {planStale ? (
                <button
                  onClick={dryRun}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
                  style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}${OPACITY_30}` }}
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Re-run dry run
                </button>
              ) : (
                <button
                  onClick={confirmWrite}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
                  style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}${OPACITY_30}` }}
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Confirm write
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
