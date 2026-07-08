'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, ShieldCheck, BellOff, EyeOff, Clock, RotateCcw, Check, X,
} from 'lucide-react';
import { STATUS_BLOCKER, STATUS_INFO, OPACITY_12, OPACITY_20 } from '@/lib/chart-colors';
import type { PlaytestFinding, TriageStatus } from '@/types/game-director';
import {
  SEVERITY_TOKENS, CATEGORY_LABELS, TRIAGE_TOKENS, severitySurface,
} from '@/lib/game-director-styles';

export function FindingCard({
  finding,
  index,
  busy,
  onApply,
  onFixDispatched,
}: {
  finding: PlaytestFinding;
  index: number;
  busy: boolean;
  onApply: (
    finding: PlaytestFinding,
    triageStatus: TriageStatus,
    note?: string,
    snoozedUntil?: string | null,
  ) => Promise<void>;
  onFixDispatched: (finding: PlaytestFinding) => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const [draftNote, setDraftNote] = useState(finding.triageNote);
  const [pendingStatus, setPendingStatus] = useState<TriageStatus | null>(null);

  const token = SEVERITY_TOKENS[finding.severity];
  const Icon = token.icon;
  const catLabel = CATEGORY_LABELS[finding.category] ?? finding.category;
  const triageToken = TRIAGE_TOKENS[finding.triageStatus];
  const TriageIcon = triageToken.icon;
  const dimmed = finding.triageStatus === 'false-positive' || finding.triageStatus === 'ignore';

  const submit = async () => {
    if (!pendingStatus) return;
    let snoozedUntil: string | null | undefined;
    if (pendingStatus === 'snooze') {
      // Snooze for 7 days by default. The note field can be used to track intent.
      snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      snoozedUntil = null;
    }
    await onApply(finding, pendingStatus, draftNote, snoozedUntil);
    setShowNote(false);
    setPendingStatus(null);
  };

  const requestTriage = (status: TriageStatus) => {
    // For destructive states (false-positive / ignore / snooze), open the
    // note prompt so the user can record *why* before committing.
    if (status === 'confirmed' && !finding.triageNote && finding.triageStatus !== 'confirmed') {
      // Confirmed doesn't need a note prompt — apply immediately.
      void onApply(finding, status, finding.triageNote, null);
      return;
    }
    if (status === 'active') {
      void onApply(finding, status, '', null);
      return;
    }
    setPendingStatus(status);
    setDraftNote(finding.triageNote);
    setShowNote(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.4) }}
      className={`rounded-lg border px-3.5 py-3 ${dimmed ? 'opacity-60' : ''}`}
      style={severitySurface(finding.severity)}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: token.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-semibold text-text">{finding.title}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted">{catLabel}</span>
            {finding.relatedModule && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted-hover">{finding.relatedModule}</span>
            )}
            {finding.triageStatus !== 'active' && (
              <span
                className="inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded"
                style={{ color: triageToken.color, backgroundColor: `${triageToken.color}${OPACITY_12}`, border: `1px solid ${triageToken.color}${OPACITY_20}` }}
              >
                <TriageIcon className="w-2.5 h-2.5" aria-hidden="true" />
                {triageToken.label}
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted-hover leading-relaxed mb-1.5">{finding.description}</p>
          {finding.suggestedFix && (
            <p className="text-sm text-text-muted leading-relaxed italic">
              Fix: {finding.suggestedFix}
            </p>
          )}
          {finding.triageNote && !showNote && (
            <p className="mt-1.5 text-xs text-text-muted bg-background border border-border rounded px-2 py-1">
              <span className="font-semibold text-text-muted-hover">Triage note:</span> {finding.triageNote}
            </p>
          )}
        </div>
        <span className="text-2xs text-text-muted flex-shrink-0">{finding.confidence}%</span>
      </div>

      {showNote ? (
        <div className="mt-2.5 flex items-end gap-2">
          <label className="flex-1 min-w-0">
            <span className="block text-2xs font-semibold uppercase tracking-wider text-text-muted mb-1">
              Note ({pendingStatus ? TRIAGE_TOKENS[pendingStatus].label : 'Triage'})
            </span>
            <textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="Why is this triaged? (optional)"
              rows={2}
              className="focus-ring-inset w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs text-text outline-none focus:border-border-bright resize-none"
            />
          </label>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { void submit(); }}
              disabled={busy}
              aria-label="Save triage"
              className="focus-ring flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40"
              style={{ backgroundColor: `${STATUS_BLOCKER}${OPACITY_12}`, color: STATUS_BLOCKER, border: `1px solid ${STATUS_BLOCKER}${OPACITY_20}` }}
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button
              onClick={() => { setShowNote(false); setPendingStatus(null); }}
              disabled={busy}
              aria-label="Cancel triage"
              className="focus-ring flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-text-muted hover:bg-surface transition-colors disabled:opacity-40"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap" role="group" aria-label="Triage actions">
          <TriageButton
            label="Confirm"
            icon={ShieldCheck}
            active={finding.triageStatus === 'confirmed'}
            color={STATUS_BLOCKER}
            disabled={busy}
            onClick={() => requestTriage('confirmed')}
          />
          <TriageButton
            label="False positive"
            icon={BellOff}
            active={finding.triageStatus === 'false-positive'}
            color={STATUS_INFO}
            disabled={busy}
            onClick={() => requestTriage('false-positive')}
          />
          <TriageButton
            label="Ignore"
            icon={EyeOff}
            active={finding.triageStatus === 'ignore'}
            color={'var(--text-muted)'}
            disabled={busy}
            onClick={() => requestTriage('ignore')}
          />
          <TriageButton
            label="Snooze 7d"
            icon={Clock}
            active={finding.triageStatus === 'snooze'}
            color={TRIAGE_TOKENS.snooze.color}
            disabled={busy}
            onClick={() => requestTriage('snooze')}
          />
          {finding.triageStatus !== 'active' && (
            <TriageButton
              label="Reset"
              icon={RotateCcw}
              active={false}
              color={'var(--text-muted)'}
              disabled={busy}
              onClick={() => requestTriage('active')}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}

function TriageButton({
  label,
  icon: Icon,
  active,
  color,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof ShieldCheck;
  active: boolean;
  color: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="focus-ring inline-flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-all disabled:opacity-40"
      style={
        active
          ? { backgroundColor: `${color}${OPACITY_20}`, color, border: `1px solid ${color}${OPACITY_20}` }
          : { color: 'var(--text-muted)', border: '1px solid transparent' }
      }
    >
      <Icon className="w-2.5 h-2.5" aria-hidden="true" />
      {label}
    </button>
  );
}
