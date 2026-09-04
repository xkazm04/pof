'use client';

import { useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiFetch, tryApiFetch } from '@/lib/api-utils';
import { Modal } from '@/components/ui/Modal';
import { PromptDiffView } from '@/components/modules/evaluator/PromptDiffView';
import type { WritePlan } from '@/lib/blueprint-transpiler-write';
import type { PofCompileResult } from '@/types/pof-bridge';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
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

/** How long to let a Live Coding compile run before the bridge gives up. */
const COMPILE_TIMEOUT_SECONDS = 120;

/** What the server confirmed it wrote — the WRITTEN rung, nothing above it. */
type WriteReceipt = { written: string[]; moduleInBuild: boolean; uprojectFile: string };

/**
 * How far up the fidelity ladder this write has actually been carried.
 * 'none' — the files are written and nothing has looked at them.
 * 'skipped' — no compiler ever will (the module is not in the build).
 * 'unreachable' — the UE bridge did not answer, so the write is UNVERIFIED,
 * which is emphatically not a pass.
 * 'done' — a real verdict from /api/pof-bridge/compile, pass or fail.
 */
type CompileVerdict =
  | { kind: 'none' }
  | { kind: 'skipped'; why: string }
  | { kind: 'running' }
  | { kind: 'unreachable'; error: string }
  | { kind: 'done'; result: PofCompileResult };

/**
 * The half of the receipt the app used to leave unsaid. A filesystem write
 * proves only that bytes landed; whether they COMPILE is a separate question
 * with its own answer — including "we could not ask", which is stated as
 * UNVERIFIED and never as a pass.
 */
function CompileVerdictLine({ verdict, moduleName }: { verdict: CompileVerdict; moduleName: string }) {
  if (verdict.kind === 'none') {
    return (
      <span className="text-text-muted">Not compiled — no verdict was requested.</span>
    );
  }
  if (verdict.kind === 'skipped') {
    return (
      <span data-testid="compile-skipped" className="flex items-start gap-1" style={{ color: STATUS_WARNING }}>
        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px" />
        <span>Not compiled — {verdict.why}. Add {moduleName} to the build first.</span>
      </span>
    );
  }
  if (verdict.kind === 'running') {
    return (
      <span className="flex items-center gap-1 text-text-muted">
        <Loader2 className="w-3 h-3 animate-spin" /> Asking the UE bridge to compile…
      </span>
    );
  }
  if (verdict.kind === 'unreachable') {
    return (
      <span data-testid="compile-unverified" className="flex items-start gap-1" style={{ color: STATUS_WARNING }}>
        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px" />
        <span>
          Not verified — the UE bridge is not reachable ({verdict.error}). The files are written; nothing has
          compiled them.
        </span>
      </span>
    );
  }

  const { result } = verdict;
  const ok = result.summary?.success ?? result.status === 'success';
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  return (
    <span data-testid="compile-verdict" className="flex flex-col gap-0.5">
      <span className="flex items-start gap-1" style={{ color: ok ? STATUS_SUCCESS : STATUS_ERROR }}>
        {ok ? <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-px" /> : <XCircle className="w-3 h-3 flex-shrink-0 mt-px" />}
        <span>
          {ok
            ? `Compiled — rung: compiles (${result.summary?.warningCount ?? 0} warnings).`
            : `Compile ${result.status} — rung stays at written (${result.summary?.errorCount ?? errors.length} errors).`}
        </span>
      </span>
      {errors.slice(0, 5).map((d) => (
        <span key={d.id} className="font-mono pl-4" style={{ color: STATUS_ERROR }}>
          {d.file}:{d.line} {d.code} {d.message}
        </span>
      ))}
      {errors.length > 5 && (
        <span className="pl-4 text-text-muted">…and {errors.length - 5} more.</span>
      )}
    </span>
  );
}

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
  const [receipt, setReceipt] = useState<WriteReceipt | null>(null);
  const [compile, setCompile] = useState<CompileVerdict>({ kind: 'none' });
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
  // Nothing may be confirmed into a directory that is not a UE project — the
  // server refuses it anyway, and a disabled button says so before the click.
  const notUeProject = plan !== null && !plan.project.isUeProject;
  // Last line of defence: the header's `<MODULE>_API` macro must name the
  // module the file is being written into. If it does not, the class is
  // exported from a module it does not live in — a link error, and one nothing
  // in the app used to mention.
  const macroMismatch = header.length > 0 && !headerDeclaresModule(header, moduleName);

  const dryRun = useCallback(async () => {
    // Freeze what this plan is computed against at request time.
    const snap: PlanSnapshot = { header, source, className, moduleName };
    setBusy(true); setErr(null); setReceipt(null); setCompile({ kind: 'none' });
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
      const data = await apiFetch<WriteReceipt>('/api/blueprint-transpiler/write', {
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
      setReceipt(data); setPlan(null); setSnapshot(null);
      // A write is only the WRITTEN rung. Ask the UE bridge to compile so the
      // receipt can either climb to COMPILES or say plainly that it did not.
      if (!data.moduleInBuild) {
        setCompile({
          kind: 'skipped',
          why: 'the module is not part of the build, so no compiler will ever read these files',
        });
      } else {
        setCompile({ kind: 'running' });
        const res = await tryApiFetch<PofCompileResult>('/api/pof-bridge/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waitForComplete: true, timeoutSeconds: COMPILE_TIMEOUT_SECONDS }),
        });
        setCompile(res.ok ? { kind: 'done', result: res.data } : { kind: 'unreachable', error: res.error });
      }
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

      {receipt && (
        <span data-testid="write-receipt" className="text-2xs flex flex-col gap-0.5">
          <span className="flex items-center gap-1" style={{ color: STATUS_SUCCESS }}>
            <CheckCircle2 className="w-3 h-3" />
            Wrote {receipt.written.length} files into {receipt.uprojectFile} — rung: written
          </span>
          <CompileVerdictLine verdict={compile} moduleName={moduleName} />
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

            {!plan.project.isUeProject && (
              <div
                data-testid="not-a-ue-project"
                className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-2xs"
                style={{
                  backgroundColor: `${STATUS_ERROR}${OPACITY_10}`,
                  border: `1px solid ${STATUS_ERROR}${OPACITY_30}`,
                  color: STATUS_ERROR,
                }}
              >
                <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1">
                  No <code className="font-mono">.uproject</code> in {projectPath} — this is not a UE project, and the
                  write will be refused rather than manufacture a Source/ tree inside it.
                </span>
              </div>
            )}

            {plan.project.isUeProject && !plan.project.moduleInBuild && (
              <div
                data-testid="module-not-in-build"
                className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-2xs"
                style={{
                  backgroundColor: `${STATUS_WARNING}${OPACITY_10}`,
                  border: `1px solid ${STATUS_WARNING}${OPACITY_30}`,
                  color: STATUS_WARNING,
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1">
                  <code className="font-mono">{plan.project.buildCsRelPath}</code> does not exist, so
                  <strong> this module is not part of the build</strong> — the files will land on disk but no
                  compiler will ever read them.
                </span>
              </div>
            )}

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
              {planStale || macroMismatch || notUeProject ? (
                codeStale || macroMismatch || notUeProject ? (
                  <button
                    disabled
                    title={notUeProject
                      ? 'That directory contains no .uproject — pick a real UE project first'
                      : macroMismatch
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
