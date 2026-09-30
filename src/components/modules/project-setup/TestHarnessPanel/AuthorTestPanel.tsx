'use client';

import { FilePlus2, Loader2, Play, Send, X } from 'lucide-react';
import { InlineTerminal } from '@/components/cli/InlineTerminal';
import { ACCENT_VIOLET, STATUS_ERROR, STATUS_INFO, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import type { AuthorState } from './waitingTests';

const SHOWN_REQUESTERS = 12;

interface AuthorTestPanelProps {
  state: Exclude<AuthorState, { phase: 'idle' }>;
  /** Hand the task to Claude — the ONLY place a CLI run starts from this panel. */
  onSend: () => void;
  /** Run + settle this test (the only path to 'verified'). */
  onVerify: () => void;
  onClose: () => void;
  /** A CLI run is in flight on the author session. */
  cliRunning: boolean;
  /** A Run + settle is in flight somewhere in the tab. */
  runBusy: boolean;
  /** The author CLI session, once one exists — mounted inline so the prompt has a terminal. */
  sessionId: string | null;
}

function PhaseLine({ state }: { state: AuthorTestPanelProps['state'] }) {
  switch (state.phase) {
    case 'preview':
      return <p className="text-2xs text-text-muted">Preview only: nothing is sent until you click Send to Claude. Claude writes the file and builds; the app writes no UE file.</p>;
    case 'dispatched':
      return <p className="text-2xs" style={{ color: STATUS_INFO }}>Sent to Claude: authoring in the terminal below.</p>;
    case 'authored-unverified':
      return (
        <p className="text-2xs" role="status" style={{ color: STATUS_WARNING }}>
          Authored — not verified. The CLI finishing is not a test result: run it and settle its gates (a fresh scaffold fails loud until its body is real).
        </p>
      );
    case 'author-failed':
      return <p className="text-2xs" role="status" style={{ color: STATUS_ERROR }}>Authoring failed: {state.reason}</p>;
    case 'verified': {
      const s = state.settle;
      return (
        <p className="text-2xs" role="status" style={{ color: s.failed > 0 ? STATUS_ERROR : STATUS_SUCCESS }}>
          Verified by Run + settle: passed {s.passed} · failed {s.failed} · deferred {s.deferred} (settled {s.settled})
        </p>
      );
    }
  }
}

/**
 * Author a waiting test UE source lacks: the generated scaffold (path + C++), the gates it
 * will settle, and an explicit Send to Claude. Opening the panel sends nothing; the CLI's
 * success leaves the test 'authored — not verified' until Run + settle observes it.
 */
export function AuthorTestPanel({ state, onSend, onVerify, onClose, cliRunning, runBusy, sessionId }: AuthorTestPanelProps) {
  const extra = state.requestedBy.length - SHOWN_REQUESTERS;
  const canSend = state.phase === 'preview' || state.phase === 'author-failed';
  return (
    <div className="mt-2 space-y-2 rounded border border-border bg-surface p-2" aria-label={`Author ${state.testName} panel`}>
      <div className="flex items-center gap-2">
        <FilePlus2 className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT_VIOLET }} />
        <span className="text-2xs text-text-muted">Scaffold</span>
        <span className="text-2xs font-mono text-text truncate" title={state.scaffold.suggestedPath}>{state.scaffold.suggestedPath}</span>
        <button aria-label="Close author panel" className="ml-auto text-text-muted hover:text-text" onClick={onClose}>
          <X className="w-3 h-3" />
        </button>
      </div>

      <pre className="max-h-64 overflow-auto rounded bg-background p-2 text-2xs font-mono text-text whitespace-pre">{state.scaffold.code}</pre>

      <div className="text-2xs text-text-muted">
        Settles {state.requestedBy.length} requesting gate{state.requestedBy.length !== 1 ? 's' : ''}:
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
          {state.requestedBy.slice(0, SHOWN_REQUESTERS).map((r) => (
            <li key={`${r.catalogId}/${r.entityId}/${r.step}`}>{`${r.catalogId}/${r.entityId}/${r.step}`}</li>
          ))}
          {extra > 0 && <li>…and {extra} more</li>}
        </ul>
      </div>

      <PhaseLine state={state} />

      <div className="flex items-center gap-2">
        {canSend && (
          <button
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-border hover:bg-surface-hover disabled:opacity-40"
            style={{ color: ACCENT_VIOLET }}
            disabled={cliRunning}
            onClick={onSend}
          >
            <Send className="w-3 h-3" />
            Send to Claude
          </button>
        )}
        {state.phase === 'dispatched' && <Loader2 className="w-3 h-3 animate-spin text-text-muted" />}
        {(state.phase === 'authored-unverified' || state.phase === 'verified') && (
          <button
            aria-label={`Verify ${state.testName}`}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-border hover:bg-surface-hover disabled:opacity-40"
            style={{ color: ACCENT_VIOLET }}
            disabled={runBusy}
            onClick={onVerify}
          >
            <Play className="w-3 h-3" />
            Run + settle
          </button>
        )}
      </div>

      {sessionId && state.phase !== 'preview' && <InlineTerminal sessionId={sessionId} />}
    </div>
  );
}
