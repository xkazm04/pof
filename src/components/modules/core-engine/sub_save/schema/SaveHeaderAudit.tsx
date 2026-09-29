'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSearch, RefreshCw, Wrench } from 'lucide-react';
import { BlueprintPanel, SectionHeader, SAVE_TYPE } from '../_shared/design';
import { ACCENT } from '../_shared/data';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { useProjectStore } from '@/stores/projectStore';
import { tryApiFetch } from '@/lib/api-utils';
import { TaskFactory } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import { getModuleChecklist } from '@/lib/module-registry';
import {
  auditSaveClass, buildSaveFixPrompt, fixCount, type SaveAudit, type SaveClass,
} from '@/lib/save-schema/header-audit';
import { withOpacity, OPACITY_10, STATUS_ERROR, STATUS_WARNING, STATUS_SUCCESS } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import type { Result } from '@/types/result';

interface AuditResponse { headersScanned: number; saveClasses: SaveClass[] }

type AuditState =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; error: string }
  | { status: 'done'; data: AuditResponse };

/** A settled audit response, tagged with the request (project + Re-audit round) it answers. */
interface Settled { path: string; round: number; res: Result<AuditResponse, string> }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const postAudit = (projectPath: string) =>
  tryApiFetch<AuditResponse>('/api/save-schema/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath }),
  });

/**
 * "Your save class" — audits the project's REAL USaveGame subclass (read-only POST over
 * Source/) against the fields.ts design and the save canon. The only UE write is the CLI
 * task behind an explicit click on Fix (or Create it, when there is no save class).
 */
export function SaveHeaderAudit({ moduleId }: { moduleId: SubModuleId }) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const [round, setRound] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const { execute, isRunning } = useModuleCLI({ moduleId, sessionKey: 'save-header-audit', label: 'Save Audit', accentColor: ACCENT });

  // Audit on mount, on project change and on each Re-audit round. Read-only: never dispatches.
  useEffect(() => {
    if (!projectPath) return;
    let live = true;
    void postAudit(projectPath).then((res) => { if (live) setSettled({ path: projectPath, round, res }); });
    return () => { live = false; };
  }, [projectPath, round]);

  const state = useMemo<AuditState>(() => {
    if (!projectPath) return { status: 'idle' };
    if (!settled || settled.path !== projectPath || settled.round !== round) return { status: 'loading' };
    return settled.res.ok ? { status: 'done', data: settled.res.data } : { status: 'error', error: settled.res.error };
  }, [projectPath, round, settled]);

  /** Audit only the leaf classes: the object actually saved is the most-derived one. */
  const audits = useMemo<SaveAudit[]>(() => {
    if (state.status !== 'done') return [];
    const all = state.data.saveClasses;
    return all.filter((c) => !all.some((o) => o.chain[1] === c.name)).map((c) => auditSaveClass(c));
  }, [state]);

  const createSaveClass = useCallback(() => {
    if (isRunning) return;
    const item = getModuleChecklist(moduleId).find((i) => i.id === 'as-1');
    void execute(TaskFactory.checklist(moduleId, 'as-1', item?.prompt ?? '', item?.label ?? 'Create USaveGame subclass', getAppOrigin()));
  }, [isRunning, moduleId, execute]);

  const fix = useCallback((audit: SaveAudit) => {
    const prompt = buildSaveFixPrompt(audit);
    if (!prompt || isRunning) return;
    void execute(TaskFactory.askClaude(moduleId, prompt, `Fix ${audit.className} (${plural(fixCount(audit), 'finding')})`));
  }, [isRunning, moduleId, execute]);

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SectionHeader label="Your save class" icon={FileSearch} color={ACCENT} />
        <div className="flex items-center gap-2 mb-3">
          {state.status === 'done' && (
            <span className={`${SAVE_TYPE.meta} text-text-muted`}>{plural(state.data.headersScanned, 'header')} scanned</span>
          )}
          {projectPath && (
            <button
              type="button"
              onClick={() => setRound((r) => r + 1)}
              disabled={state.status === 'loading'}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border text-text-muted hover:bg-surface/60 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Re-audit
            </button>
          )}
        </div>
      </div>

      {!projectPath && <p className={`${SAVE_TYPE.body} text-text-muted`}>Set up a UE project to audit its save class.</p>}
      {state.status === 'loading' && <p className={`${SAVE_TYPE.body} text-text-muted`}>Reading Source/ headers...</p>}
      {state.status === 'error' && <p className={SAVE_TYPE.body} style={{ color: STATUS_ERROR }}>Audit failed: {state.error}</p>}

      {state.status === 'done' && audits.length === 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className={`${SAVE_TYPE.body} text-text-muted`}>
            No USaveGame subclass in Source/ ({plural(state.data.headersScanned, 'header')}).
          </p>
          <ActionButton onClick={createSaveClass} disabled={isRunning} label="Create it (as-1)" />
        </div>
      )}

      {audits.map((audit) => (
        <ClassAudit key={audit.className} audit={audit} onFix={() => fix(audit)} disabled={isRunning} />
      ))}
    </BlueprintPanel>
  );
}

function ActionButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: withOpacity(ACCENT, OPACITY_10) }}
    >
      <Wrench className="w-3 h-3" /> {label}
    </button>
  );
}

function ClassAudit({ audit, onFix, disabled }: { audit: SaveAudit; onFix: () => void; disabled: boolean }) {
  const k = fixCount(audit);
  const errors = audit.findings.filter((f) => f.severity === 'error').length;
  const warns = audit.findings.length - errors;
  const mismatch = new Map(audit.mismatched.map((m) => [m.field, m]));

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className={`${SAVE_TYPE.title} font-mono`} style={{ color: ACCENT }}>{audit.className}</div>
          <div className={`${SAVE_TYPE.meta} text-text-muted truncate`}>{audit.headerPath}</div>
        </div>
        <div className={`flex items-center gap-3 ${SAVE_TYPE.meta}`}>
          <span className="text-text-muted">{audit.present.length}/{audit.design.length} design fields</span>
          <span style={{ color: errors ? STATUS_ERROR : STATUS_SUCCESS }}>{plural(errors, 'error')}</span>
          <span style={{ color: warns ? STATUS_WARNING : STATUS_SUCCESS }}>{plural(warns, 'warning')}</span>
          <ActionButton onClick={onFix} disabled={disabled || k === 0} label={k === 0 ? 'Nothing to fix' : `Fix ${plural(k, 'finding')} in UE`} />
        </div>
      </div>

      {audit.findings.length > 0 && (
        <ul className="space-y-1">
          {audit.findings.map((f) => (
            <li key={`${f.kind}:${f.field}`} className={`${SAVE_TYPE.body} flex gap-2`}>
              <span className={`${SAVE_TYPE.meta} ${SAVE_TYPE.code} shrink-0`} style={{ color: f.severity === 'error' ? STATUS_ERROR : STATUS_WARNING }}>{f.kind}</span>
              <span className="font-mono shrink-0">{f.field ?? '(class)'}</span>
              <span className="text-text-muted">{f.rule}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-1">
        {audit.design.map((d) => {
          const missing = audit.missing.includes(d.name);
          const m = mismatch.get(d.name);
          const color = missing ? STATUS_ERROR : m ? STATUS_WARNING : STATUS_SUCCESS;
          const title = missing ? `missing: ${d.type ?? ''} ${d.name}` : m ? `declared ${m.actual}, design ${m.expected}` : `present${d.type ? `: ${d.type}` : ''}`;
          return (
            <span key={d.name} title={title} className={`${SAVE_TYPE.meta} font-mono px-1.5 py-0.5 rounded border`}
              style={{ color, borderColor: withOpacity(color, OPACITY_10) }}>
              {missing ? '- ' : m ? '~ ' : ''}{d.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
