'use client';

import { useState } from 'react';
import { ArrowLeftRight, KeyRound, Trash2, X } from 'lucide-react';
import type { RoomConnection } from '@/types/level-design';
import type { LevelEditOp } from '@/lib/level-design/level-edit';
import {
  applyLinkChange, declareGateFromCondition, grantCandidates, keyLedger, normaliseKeyIds, storedKeyIds,
  type GateGraph, type GateProposal, type LinkChange,
} from '@/lib/level-design/gate-authoring';

interface LinkInspectorProps {
  connection: RoomConnection;
  graph: GateGraph;
  getRoomName: (roomId: string) => string;
  /** The editor's one write surface; returns false when the op was refused. */
  onEdit: (op: LevelEditOp) => boolean;
  onClose: () => void;
}

const BTN = 'focus-ring px-2 py-1 rounded border text-2xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40';
const IDLE = 'border-border text-text-muted hover:text-text';
const ON = 'border-violet-400/60 bg-violet-500/15 text-violet-200';

/**
 * Edits ONE link: direction (two-way / one-way / flip), the prose condition,
 * the machine-readable required keys, and which room grants them. Nothing is
 * written until Apply, which is one `set-link-gate` op (one PUT, one undo step).
 * 'Declare gate' turns a prose-only condition into a key in one click.
 */
export function LinkInspector({ connection: conn, graph, getRoomName, onEdit, onClose }: LinkInspectorProps) {
  const [bidirectional, setBidirectional] = useState(conn.bidirectional);
  const [flip, setFlip] = useState(false);
  const [condition, setCondition] = useState(conn.condition ?? '');
  // null = untouched: stored data is only re-normalised when the designer edits it.
  const [touchedKeys, setRequires] = useState<string[] | null>(null);
  const requires = touchedKeys ?? storedKeyIds(conn.requires);
  const [keyInput, setKeyInput] = useState('');
  const [grantRoomId, setGrantRoomId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [proposal, setProposal] = useState<GateProposal | string | null>(null);

  const change: LinkChange = {
    direction: bidirectional ? 'two-way' : 'one-way',
    flip,
    condition: condition !== (conn.condition ?? '') ? condition : undefined,
    requires: touchedKeys ?? undefined,
  };
  const shaped = applyLinkChange(graph, conn.id, change);
  const draft: GateGraph = shaped.ok ? { ...graph, ...shaped.data } : graph;
  const preview = applyLinkChange(graph, conn.id, { ...change, grantRoomId: grantRoomId || undefined });
  const previewGraph: GateGraph = preview.ok ? { ...graph, ...preview.data } : draft;
  const reachable = grantCandidates(draft, conn.id);
  const candidates = reachable.ok ? reachable.data : [];
  const ledger = keyLedger(previewGraph);
  const dirty = preview.ok && Object.keys(preview.data).length > 0;

  const [fromId, toId] = flip ? [conn.toId, conn.fromId] : [conn.fromId, conn.toId];
  const title = `Link ${getRoomName(conn.fromId)} to ${getRoomName(conn.toId)}`;
  const canDeclare = storedKeyIds(conn.requires).length === 0 && (conn.condition ?? '').trim().length > 0;

  const addKey = () => {
    const next = normaliseKeyIds([...requires, keyInput]);
    setRequires(next);
    setKeyInput('');
  };
  const apply = () => {
    if (onEdit({ kind: 'set-link-gate', connectionId: conn.id, change: { ...change, grantRoomId: grantRoomId || undefined } })) {
      setFlip(false);
      setGrantRoomId('');
    }
  };
  const declare = () => {
    const res = declareGateFromCondition(graph, conn.id);
    setProposal(res.ok ? res.data : res.error);
  };
  const remove = () => {
    if (onEdit({ kind: 'unlink', connectionId: conn.id })) onClose();
  };

  return (
    <div
      role="dialog"
      aria-label={title}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
      className="absolute top-16 right-4 z-20 w-72 max-h-[80%] overflow-y-auto rounded-xl border border-violet-900/50 bg-surface-deep/95 backdrop-blur-sm p-3 space-y-3 text-xs text-text shadow-xl"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-2xs uppercase tracking-widest text-text-muted font-semibold">Link</div>
          <div className="font-mono truncate">
            {getRoomName(fromId)} {bidirectional ? '<->' : '->'} {getRoomName(toId)}
          </div>
        </div>
        <button type="button" aria-label="Close link inspector" onClick={onClose} className="focus-ring p-0.5 rounded text-text-muted hover:text-text">
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-1.5" role="group" aria-label="Direction">
        <button type="button" aria-pressed={bidirectional} onClick={() => { setBidirectional(true); setFlip(false); }} className={`${BTN} ${bidirectional ? ON : IDLE}`}>Two-way</button>
        <button type="button" aria-pressed={!bidirectional} onClick={() => setBidirectional(false)} className={`${BTN} ${!bidirectional ? ON : IDLE}`}>One-way</button>
        <button type="button" aria-label="Flip direction" disabled={bidirectional} onClick={() => setFlip((f) => !f)} className={`${BTN} ${IDLE} ml-auto flex items-center gap-1`}>
          <ArrowLeftRight className="w-3 h-3" aria-hidden="true" /> Flip
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Condition (prose)</span>
        <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="e.g. Collect the brass key"
          className="w-full px-2 py-1 rounded border border-border bg-transparent outline-none focus:border-border-bright" />
      </label>
      {canDeclare && proposal === null && (
        <button type="button" onClick={declare} className={`${BTN} ${IDLE} flex items-center gap-1`}>
          <KeyRound className="w-3 h-3" aria-hidden="true" /> Declare gate
        </button>
      )}
      {typeof proposal === 'string' && <p role="alert" className="text-amber-400">{proposal}</p>}
      {proposal !== null && typeof proposal !== 'string' && (
        <div className="space-y-1.5 rounded border border-amber-500/30 p-2">
          <div>Key <code className="font-mono text-amber-300">{proposal.key}</code> — granted by a room reached before this gate:</div>
          {proposal.grantCandidates.length === 0 && <p className="text-text-muted">No room is reachable with this gate shut.</p>}
          <div className="flex flex-wrap gap-1">
            {proposal.grantCandidates.map((id) => (
              <button key={id} type="button" aria-label={`Grant from ${getRoomName(id)}`} className={`${BTN} ${IDLE}`}
                onClick={() => onEdit({ kind: 'declare-gate', connectionId: conn.id, key: proposal.key, grantRoomId: id })}>
                {getRoomName(id)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Required keys</span>
        <ul className="space-y-1">
          {requires.map((k) => {
            const granters = ledger.keys[k]?.grantedBy ?? [];
            return (
              <li key={k} className="flex items-center gap-1.5 rounded border border-border px-1.5 py-0.5">
                <span className="font-mono">{k}</span>
                <span className={`flex-1 truncate text-2xs ${granters.length ? 'text-text-muted' : 'text-amber-400'}`}>
                  {granters.length ? `granted by ${granters.map(getRoomName).join(', ')}` : 'granted by no room'}
                </span>
                <button type="button" aria-label={`Remove key ${k}`} onClick={() => setRequires(requires.filter((x) => x !== k))} className="focus-ring text-text-muted hover:text-text">
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        <input aria-label="Add required key" list={`link-keys-${conn.id}`} value={keyInput} placeholder="add key, Enter"
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKey(); } }}
          className="w-full px-2 py-1 rounded border border-border bg-transparent font-mono outline-none focus:border-border-bright" />
        <datalist id={`link-keys-${conn.id}`}>
          {Object.keys(ledger.keys).map((k) => <option key={k} value={k} />)}
        </datalist>
      </div>

      {requires.length > 0 && (
        <div className="space-y-1">
          <span aria-hidden="true" className="block text-2xs uppercase tracking-wider text-text-muted font-semibold">Grant keys from</span>
          <select aria-label="Grant keys from" value={grantRoomId} onChange={(e) => setGrantRoomId(e.target.value)}
            className="w-full px-2 py-1 rounded border border-border bg-surface-deep outline-none">
            <option value="">— no change —</option>
            {candidates.map((id) => <option key={id} value={id}>{getRoomName(id)}</option>)}
          </select>
        </div>
      )}

      {!preview.ok && <p role="alert" className="text-amber-400">{preview.error}</p>}

      <div className="flex items-center gap-1.5 pt-1 border-t border-border">
        <button type="button" onClick={apply} disabled={!dirty} className={`${BTN} ${ON}`}>Apply</button>
        {confirmDelete ? (
          <>
            <button type="button" onClick={remove} className={`${BTN} ml-auto border-red-500/60 text-red-400`}>Confirm delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className={`${BTN} ${IDLE}`}>Cancel</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className={`${BTN} ${IDLE} ml-auto flex items-center gap-1`}>
            <Trash2 className="w-3 h-3" aria-hidden="true" /> Delete link
          </button>
        )}
      </div>
    </div>
  );
}
