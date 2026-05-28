'use client';

import { motion } from 'framer-motion';
import { AlertOctagon, AlertTriangle, CheckCircle2, Clock, Info, Sparkles } from 'lucide-react';
import type { BriefTone, ProducersBrief } from '@/lib/evaluator/brief-narrator';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, STATUS_ERROR, STATUS_BLOCKER,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';

// ─── Tone → palette ──────────────────────────────────────────────────────────

const TONE_COLOR: Record<BriefTone, string> = {
  green:    STATUS_SUCCESS,
  steady:   STATUS_INFO,
  watch:    STATUS_WARNING,
  risk:     STATUS_BLOCKER,
  critical: STATUS_ERROR,
};

function toneBg(tone: BriefTone): string {
  return `${TONE_COLOR[tone]}${OPACITY_10}`;
}

function toneBorder(tone: BriefTone): string {
  return `${TONE_COLOR[tone]}${OPACITY_20}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  brief: ProducersBrief;
}

export function BriefView({ brief }: Props) {
  const hasAnyData = brief.moduleBriefs.length > 0;

  return (
    <div className="space-y-5" data-testid="brief-view">
      {/* ── Headline + paragraph ──────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-5"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: STATUS_INFO }} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text mb-2 leading-snug">
              {brief.headline}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {brief.paragraph}
            </p>
          </div>
        </div>
      </div>

      {/* ── Module briefs ─────────────────────────────────────────────────── */}
      {hasAnyData && (
        <div>
          <SectionLabel
            text="Area by area"
            count={`${brief.moduleBriefs.length} area${brief.moduleBriefs.length === 1 ? '' : 's'}`}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {brief.moduleBriefs.map((m, i) => (
              <ModuleBriefCard
                key={m.moduleId}
                label={m.label}
                headline={m.headline}
                detail={m.detail}
                score={m.score}
                tone={m.tone}
                index={i}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Risks ─────────────────────────────────────────────────────────── */}
      {brief.risks.length > 0 && (
        <div>
          <SectionLabel
            text="Risks worth knowing"
            count={`${brief.risks.length} item${brief.risks.length === 1 ? '' : 's'}`}
          />
          <div className="space-y-2">
            {brief.risks.map((r, i) => (
              <RiskCard
                key={r.id}
                title={r.title}
                consequence={r.consequence}
                timeToFix={r.timeToFix}
                tone={r.tone}
                index={i}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Highlights ────────────────────────────────────────────────────── */}
      {brief.highlights.length > 0 && (
        <div>
          <SectionLabel text="What’s going well" count="" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {brief.highlights.map((m, i) => (
              <HighlightCard
                key={`highlight-${m.moduleId}`}
                label={m.label}
                headline={m.headline}
                index={i}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!hasAnyData && brief.risks.length === 0 && (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <Info className="w-8 h-8 mx-auto mb-3 text-text-muted" />
          <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
            Nothing to brief on yet. Run a quality review on at least one area and the project will speak up.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ text, count }: { text: string; count: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
        {text}
      </span>
      {count && <span className="text-2xs text-text-muted">{count}</span>}
    </div>
  );
}

function ModuleBriefCard({
  label,
  headline,
  detail,
  score,
  tone,
  index,
}: {
  label: string;
  headline: string;
  detail: string | null;
  score: number;
  tone: BriefTone;
  index: number;
}) {
  const color = TONE_COLOR[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.base, delay: index * MOTION.staggerChildren }}
      className="rounded-lg border p-3"
      style={{ backgroundColor: toneBg(tone), borderColor: toneBorder(tone) }}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <span className="text-xs font-semibold text-text">{headline}</span>
        <span
          className="text-xs font-bold flex-shrink-0 tabular-nums"
          style={{ color }}
          aria-label={`${label} health score ${score} out of 100`}
        >
          {score}
        </span>
      </div>
      {detail && (
        <p className="text-xs text-text-muted-hover leading-relaxed">
          {detail}
        </p>
      )}
    </motion.div>
  );
}

function RiskCard({
  title,
  consequence,
  timeToFix,
  tone,
  index,
}: {
  title: string;
  consequence: string;
  timeToFix: string;
  tone: BriefTone;
  index: number;
}) {
  const color = TONE_COLOR[tone];
  const Icon = tone === 'critical' ? AlertOctagon : tone === 'risk' ? AlertTriangle : Info;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.base, delay: index * MOTION.staggerChildren }}
      className="rounded-lg border px-3.5 py-3"
      style={{ backgroundColor: toneBg(tone), borderColor: toneBorder(tone) }}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-text mb-1">{title}</div>
          <p className="text-xs text-text-muted-hover leading-relaxed mb-2">
            {consequence}
          </p>
          <div className="inline-flex items-center gap-1.5 text-2xs px-2 py-0.5 rounded bg-border text-text-muted">
            <Clock className="w-2.5 h-2.5" />
            {timeToFix}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function HighlightCard({
  label,
  headline,
  index,
}: {
  label: string;
  headline: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.base, delay: index * MOTION.staggerChildren }}
      className="rounded-lg border p-3 flex items-center gap-3"
      style={{ backgroundColor: toneBg('green'), borderColor: toneBorder('green') }}
    >
      <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: TONE_COLOR.green }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-text">{headline}</div>
        <div className="text-2xs text-text-muted">{label}</div>
      </div>
    </motion.div>
  );
}
