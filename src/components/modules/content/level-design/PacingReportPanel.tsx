'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle, AlertOctagon, Info, ShieldCheck, Filter,
} from 'lucide-react';
import type { LevelDesignDocument } from '@/types/level-design';
import {
  lintLevelPacing,
  RULE_LABELS,
  type PacingFinding,
  type PacingSeverity,
  type PacingRuleId,
} from '@/lib/level-design/pacing-linter';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  OPACITY_10, OPACITY_20, OPACITY_40,
} from '@/lib/chart-colors';

const SEVERITY_COLORS: Record<PacingSeverity, string> = {
  info: STATUS_INFO,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
};

const SEVERITY_ORDER: PacingSeverity[] = ['critical', 'warning', 'info'];

interface PacingReportPanelProps {
  doc: LevelDesignDocument;
  accentColor: string;
  onSelectRoom: (roomId: string) => void;
}

export function PacingReportPanel({ doc, accentColor, onSelectRoom }: PacingReportPanelProps) {
  const result = useMemo(() => lintLevelPacing(doc), [doc]);
  const [severityFilter, setSeverityFilter] = useState<PacingSeverity | 'all'>('all');
  const [ruleFilter, setRuleFilter] = useState<PacingRuleId | 'all'>('all');

  const ruleCounts = useMemo(() => {
    const counts: Partial<Record<PacingRuleId, number>> = {};
    for (const f of result.findings) {
      counts[f.ruleId] = (counts[f.ruleId] ?? 0) + 1;
    }
    return counts;
  }, [result.findings]);

  const filtered = useMemo(() => {
    return result.findings.filter((f) => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
      if (ruleFilter !== 'all' && f.ruleId !== ruleFilter) return false;
      return true;
    });
  }, [result.findings, severityFilter, ruleFilter]);

  const grouped = useMemo(() => {
    const order = new Map<PacingSeverity, PacingFinding[]>();
    for (const s of SEVERITY_ORDER) order.set(s, []);
    for (const f of filtered) order.get(f.severity)?.push(f);
    return order;
  }, [filtered]);

  const roomById = useMemo(
    () => new Map(doc.rooms.map((r) => [r.id, r] as const)),
    [doc.rooms],
  );

  if (doc.rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
        <ShieldCheck className="w-6 h-6 text-text-muted/40" />
        <p className="text-xs text-text-muted">Add rooms to run the pacing linter.</p>
      </div>
    );
  }

  if (result.findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`,
            border: `1px solid ${STATUS_SUCCESS}${OPACITY_40}`,
          }}
        >
          <ShieldCheck className="w-6 h-6" style={{ color: STATUS_SUCCESS }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-text">No pacing issues found</p>
          <p className="text-xs text-text-muted mt-1">
            {doc.rooms.length} rooms checked against {Object.keys(RULE_LABELS).length} design rules.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <SummaryChip
          label="All"
          count={result.findings.length}
          active={severityFilter === 'all'}
          accent={accentColor}
          onClick={() => setSeverityFilter('all')}
        />
        {SEVERITY_ORDER.map((sev) => {
          const count = result.counts[sev];
          if (count === 0) return null;
          return (
            <SummaryChip
              key={sev}
              label={sev}
              count={count}
              active={severityFilter === sev}
              accent={SEVERITY_COLORS[sev]}
              onClick={() => setSeverityFilter((prev) => (prev === sev ? 'all' : sev))}
            />
          );
        })}

        {/* Rule filter */}
        <div className="flex items-center gap-1 ml-auto">
          <Filter className="w-3 h-3 text-text-muted" />
          <select
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value as PacingRuleId | 'all')}
            className="px-2 py-1 bg-surface border border-border rounded text-2xs text-text outline-none focus:border-border-bright transition-colors"
          >
            <option value="all">All rules ({result.findings.length})</option>
            {(Object.keys(RULE_LABELS) as PacingRuleId[]).map((rid) => {
              const c = ruleCounts[rid] ?? 0;
              if (c === 0) return null;
              return (
                <option key={rid} value={rid}>
                  {RULE_LABELS[rid]} ({c})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Findings list */}
      {filtered.length === 0 ? (
        <div className="text-xs text-text-muted py-6 text-center">
          No findings match the current filter.
        </div>
      ) : (
        <div className="space-y-4">
          {SEVERITY_ORDER.map((sev) => {
            const items = grouped.get(sev) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={sev}>
                <h4 className="text-2xs uppercase tracking-widest text-text-muted mb-2 font-semibold flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: SEVERITY_COLORS[sev] }}
                  />
                  {sev} ({items.length})
                </h4>
                <div className="space-y-2">
                  {items.map((f) => (
                    <FindingCard
                      key={f.id}
                      finding={f}
                      roomNames={f.roomIds
                        .map((id) => roomById.get(id)?.name)
                        .filter((n): n is string => Boolean(n))}
                      onJump={() => f.roomIds[0] && onSelectRoom(f.roomIds[0])}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryChip({
  label,
  count,
  active,
  accent,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-medium uppercase tracking-wider transition-all"
      style={{
        backgroundColor: active ? `${accent}${OPACITY_20}` : `${accent}${OPACITY_10}`,
        color: accent,
        border: `1px solid ${accent}${active ? OPACITY_40 : OPACITY_20}`,
      }}
    >
      <span>{label}</span>
      <span
        className="px-1.5 py-0.5 rounded text-2xs font-mono"
        style={{ backgroundColor: `${accent}${OPACITY_20}` }}
      >
        {count}
      </span>
    </button>
  );
}

function FindingCard({
  finding,
  roomNames,
  onJump,
}: {
  finding: PacingFinding;
  roomNames: string[];
  onJump: () => void;
}) {
  const color = SEVERITY_COLORS[finding.severity];
  const Icon =
    finding.severity === 'critical' ? AlertOctagon
    : finding.severity === 'warning' ? AlertTriangle
    : Info;

  return (
    <div
      className="rounded-lg border p-3 transition-colors"
      style={{
        backgroundColor: `${color}${OPACITY_10}`,
        borderColor: `${color}${OPACITY_20}`,
      }}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-semibold text-text">{finding.title}</h5>
            <span
              className="text-2xs uppercase tracking-wider font-mono px-1.5 py-0.5 rounded"
              style={{ color, backgroundColor: `${color}${OPACITY_20}` }}
            >
              {RULE_LABELS[finding.ruleId]}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">{finding.message}</p>

          <div
            className="mt-2 px-2.5 py-1.5 rounded text-xs leading-relaxed"
            style={{
              backgroundColor: `${color}${OPACITY_10}`,
              borderLeft: `2px solid ${color}`,
              color: 'var(--text)',
            }}
          >
            <span className="text-2xs uppercase tracking-wider font-semibold mr-1.5" style={{ color }}>
              Fix:
            </span>
            {finding.suggestion}
          </div>

          {roomNames.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-2xs text-text-muted">Affects:</span>
              {roomNames.slice(0, 6).map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted-hover"
                >
                  {name}
                </span>
              ))}
              {roomNames.length > 6 && (
                <span className="text-2xs text-text-muted">+{roomNames.length - 6}</span>
              )}
              <button
                onClick={onJump}
                className="ml-auto text-2xs uppercase tracking-wider font-medium px-2 py-0.5 rounded transition-colors hover:bg-surface"
                style={{ color }}
              >
                Jump →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
