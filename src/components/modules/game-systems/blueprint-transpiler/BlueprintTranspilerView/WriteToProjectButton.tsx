'use client';

import { useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api-utils';
import { Modal } from '@/components/ui/Modal';
import { PromptDiffView } from '@/components/modules/evaluator/PromptDiffView';
import type { WritePlan } from '@/lib/blueprint-transpiler-write';
import {
  STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { ACCENT } from './constants';
import { apiMacroFor, headerDeclaresModule } from './helpers';

// ─── Write to Project (dry-run diff → confirm) ──────────────────────────────

// Everything the open plan was diffed against, frozen at dry-run time. Confirm
// sends THIS snapshot — never the live props — so what is written to disk is
// exactly what the user reviewed, even if a re-transpile changed the props
// while the modal was open.
type PlanSnapshot = {
  header: string;
  source: string;
  className: string;
  moduleName: string;
};

export function WriteToProjectButton({ className, header, source, projectPath, moduleName, onModuleChange }: {
  className: string;
  header: string;
  source: string;
  projectPath: string;
  /** Owned by the view — the same value codegen used for the API macro. */
  moduleName: string;
  onModuleChange: (next: string) => void;
}) {
  const [plan, setPlan] = useState<WritePlan | null>(null);
  const [snapshot, setSnapshot] = useState<PlanSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [written, setWritten] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // The Module input lives INSIDE the dry-run modal — a changed module makes
  // the displayed diff stale (it covers paths that will no longer be written).
  const moduleStale = plan !== null && snapshot !== null && moduleName !== snapshot.moduleName;
  // A re-transpile while the modal is open changes the header/source props
  // under the still-mounted component — the rendered diff no longer matches
  // what a fresh dry-run (and the user's mental model) would produce.
  const codeStale = plan !== null && snapshot !== null && (
    header !== snapshot.header || source !== snapshot.source || className !== snapshot.className
  );
  const planStale = moduleStale || codeStale;
  // Last line of defence: the header's `<MODULE>_API` macro must name the
  // module the file is being written into. If it does not, the class is
  // exported from a module it does not live in — a link error, and one nothing
  // in the app used to mention.
  const macroMismatch = header.length > 0 && !headerDeclaresModule(header, moduleName);

  const dryRun = useCallback(async () => {
    // Freeze what this plan is computed against at request time.
    const snap: PlanSnapshot = { header, source, className, moduleName };
    setBusy(true); setErr(null); setWritten(null);
    try {
      const data = await apiFetch<WritePlan>('/api/blueprint-transpiler/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, ...snap, confirm: false }),
      });
      setPlan(data);
      setSnapshot(snap);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Dry-run failed'); }
    finally { setBusy(false); }
  }, [projectPath, moduleName, className, header, source]);

  const confirmWrite = useCallback(async () => {
    if (!plan || !snapshot) return;
    setBusy(true); setErr(null);
    try {
      const data = await apiFetch<{ written: string[] }>('/api/blueprint-transpiler/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          // Send the reviewed snapshot, NOT the live props — the diff the user
          // approved is exactly what lands on disk.
          ...snapshot,
          confirm: true,
          // The reviewed plan rides along — the server rejects the write if
          // the resolved paths or on-disk content no longer match it.
          approved: plan.files.map((f) => ({ relPath: f.relPath, before: f.before })),
        }),
      });
      setWritten(data.written); setPlan(null); setSnapshot(null);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Write failed'); }
    finally { setBusy(false); }
  }, [projectPath, plan, snapshot]);

  const closeModal = () => { setPlan(null); setSnapshot(null); };

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

      {/* Destructive write-to-disk confirm — it runs through the shared Modal
          shell so a keyboard user gets aria-modal, Escape, a focus trap and
          focus restore instead of being able to Tab out behind the backdrop. */}
      <Modal
        open={plan !== null && snapshot !== null}
        onClose={closeModal}
        title={snapshot ? `Write ${snapshot.className} to project — dry run` : 'Write to project — dry run'}
        icon={<Save className="w-4 h-4" style={{ color: ACCENT }} />}
        className="max-w-3xl"
      >
        {plan && snapshot && (
          <>
            <div className="flex items-center justify-end mb-3">
              <label className="text-2xs text-text-muted flex items-center gap-1.5">
                Module
                <input
                  value={moduleName}
                  onChange={(e) => onModuleChange(e.target.value)}
                  className="w-28 bg-surface-deep border border-border rounded px-1.5 py-0.5 text-xs text-text font-mono focus-ring"
                />
              </label>
            </div>

            {macroMismatch && (
              <div
                data-testid="api-macro-mismatch"
                className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-2xs"
                style={{
                  backgroundColor: `${STATUS_WARNING}${OPACITY_10}`,
                  border: `1px solid ${STATUS_WARNING}${OPACITY_30}`,
                  color: STATUS_WARNING,
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1">
                  The header does not declare <code className="font-mono">{apiMacroFor(moduleName)}</code>, so this class
                  would be exported from a module it does not live in — re-transpile before writing.
                </span>
              </div>
            )}

            {codeStale && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-2xs"
                style={{
                  backgroundColor: `${STATUS_WARNING}${OPACITY_10}`,
                  border: `1px solid ${STATUS_WARNING}${OPACITY_30}`,
                  color: STATUS_WARNING,
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1">
                  The transpiled code changed since this diff was computed — what&apos;s shown below is no longer what would be written.
                </span>
                <button
                  onClick={dryRun}
                  disabled={busy}
                  className="flex items-center gap-1 px-2 py-1 rounded font-medium transition-colors disabled:opacity-40 flex-shrink-0"
                  style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_15}`, color: STATUS_WARNING, border: `1px solid ${STATUS_WARNING}${OPACITY_30}` }}
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh diff
                </button>
              </div>
            )}

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
              {moduleStale && !codeStale && (
                <span className="text-2xs mr-auto" style={{ color: STATUS_WARNING }}>
                  Module changed — this diff covers Source/{snapshot.moduleName}/, not Source/{moduleName}/. Re-run the dry run.
                </span>
              )}
              <button onClick={closeModal} className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors">
                Cancel
              </button>
              {planStale || macroMismatch ? (
                codeStale || macroMismatch ? (
                  <button
                    disabled
                    title={macroMismatch
                      ? `The header declares a different module than ${moduleName} — re-transpile before confirming`
                      : 'The transpiled code changed — refresh the diff before confirming'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium opacity-40 cursor-not-allowed"
                    style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}${OPACITY_30}` }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    Confirm write
                  </button>
                ) : (
                  <button
                    onClick={dryRun}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-40"
                    style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}${OPACITY_30}` }}
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Re-run dry run
                  </button>
                )
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
          </>
        )}
      </Modal>
    </>
  );
}
