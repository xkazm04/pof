'use client';

import { useState, useCallback } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_TIMING } from '@/lib/dzin/animation-constants';
import { useDzinSelection } from '@/lib/dzin/selection-context';
import {
  SectionLabel,
  PipelineFlow,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
} from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface TagAuditPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

interface AuditCategory { name: string; status: 'pass' | 'warning' | 'error'; count: number; detail: string }

const TAG_AUDIT_CATEGORIES: AuditCategory[] = [
  { name: 'Duplicates', status: 'pass', count: 0, detail: 'No duplicate tags found' },
  { name: 'Unused', status: 'warning', count: 3, detail: 'Input.Interact, Damage.Fire, State.Invulnerable' },
  { name: 'Missing', status: 'error', count: 1, detail: 'Ability.RangedAttack referenced but not defined' },
  { name: 'Naming', status: 'pass', count: 0, detail: 'All tags follow naming convention' },
];

const TAG_USAGE_FREQUENCY = [
  { tag: 'State.Dead', count: 14 },
  { tag: 'Ability.MeleeAttack', count: 12 },
  { tag: 'Damage.Physical', count: 11 },
  { tag: 'State.Stunned', count: 9 },
  { tag: 'Ability.Dodge', count: 8 },
  { tag: 'Input.Attack', count: 7 },
  { tag: 'Damage.Magical', count: 6 },
  { tag: 'Ability.Spell', count: 5 },
  { tag: 'Input.Dodge', count: 4 },
  { tag: 'State.Invulnerable', count: 2 },
];

const TAG_AUDIT_SCORE = 85;

interface TagDetail {
  name: string;
  prefix: string;
  cooldown?: string;
  manaCost?: number;
  blockingTags: string[];
  lifecycle: string[];
  color: string;
}

const TAG_DETAIL_MAP: Record<string, TagDetail> = {
  'State.Dead': {
    name: 'Dead State', prefix: 'State', blockingTags: [],
    lifecycle: ['OnHealthDepleted', 'SetTag', 'BlockAll', 'Ragdoll', 'Cleanup'],
    color: '#ef4444',
  },
  'Ability.MeleeAttack': {
    name: 'Melee Attack', prefix: 'Ability', cooldown: 'Cooldown.MeleeAttack (0.5s)',
    manaCost: 0, blockingTags: ['State.Dead', 'State.Stunned'],
    lifecycle: ['CanActivate', 'CommitAbility', 'PlayMontage', 'ApplyDamage', 'EndAbility'],
    color: '#a855f7',
  },
  'Damage.Physical': {
    name: 'Physical Damage', prefix: 'Damage', blockingTags: ['State.Invulnerable'],
    lifecycle: ['CalcMagnitude', 'ArmorReduction', 'ApplyToTarget', 'PostExecute'],
    color: '#f97316',
  },
  'State.Stunned': {
    name: 'Stunned State', prefix: 'State', blockingTags: [],
    lifecycle: ['OnStunApplied', 'SetTag', 'BlockAbilities', 'Duration', 'RemoveTag'],
    color: '#ef4444',
  },
  'Ability.Dodge': {
    name: 'Dodge', prefix: 'Ability', cooldown: 'Cooldown.Dodge (1.5s)',
    manaCost: 10, blockingTags: ['State.Dead', 'State.Stunned'],
    lifecycle: ['CanActivate', 'CommitAbility', 'GrantInvuln', 'PlayMontage', 'EndAbility'],
    color: '#3b82f6',
  },
  'Input.Attack': {
    name: 'Attack Input', prefix: 'Input', blockingTags: ['State.Dead'],
    lifecycle: ['InputPressed', 'FindAbility', 'TryActivate', 'InputReleased'],
    color: '#06b6d4',
  },
  'Damage.Magical': {
    name: 'Magical Damage', prefix: 'Damage', blockingTags: ['State.Invulnerable'],
    lifecycle: ['CalcMagnitude', 'ResistCheck', 'ApplyToTarget', 'PostExecute'],
    color: '#f97316',
  },
  'Ability.Spell': {
    name: 'Spell Cast', prefix: 'Ability', cooldown: 'Cooldown.Spell (3.0s)',
    manaCost: 25, blockingTags: ['State.Dead', 'State.Stunned'],
    lifecycle: ['CanActivate', 'CheckMana', 'CommitAbility', 'SpawnProjectile', 'EndAbility'],
    color: '#a855f7',
  },
  'Input.Dodge': {
    name: 'Dodge Input', prefix: 'Input', blockingTags: ['State.Dead'],
    lifecycle: ['InputPressed', 'FindAbility', 'TryActivate', 'InputReleased'],
    color: '#06b6d4',
  },
  'State.Invulnerable': {
    name: 'Invulnerable State', prefix: 'State', blockingTags: [],
    lifecycle: ['OnDodge', 'SetTag', 'BlockDamage', 'Duration', 'RemoveTag'],
    color: '#22c55e',
  },
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

function statusColor(status: AuditCategory['status']): string {
  switch (status) {
    case 'pass': return STATUS_SUCCESS;
    case 'warning': return STATUS_WARNING;
    case 'error': return STATUS_ERROR;
  }
}

function statusIcon(status: AuditCategory['status']): string {
  switch (status) {
    case 'pass': return 'PASS';
    case 'warning': return 'WARN';
    case 'error': return 'FAIL';
  }
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function TagAuditMicro() {
  const scoreColor = TAG_AUDIT_SCORE >= 80 ? STATUS_SUCCESS : TAG_AUDIT_SCORE >= 60 ? STATUS_WARNING : STATUS_ERROR;

  return (
    <div className="flex flex-col items-center justify-center gap-1 p-2">
      <ClipboardCheck className="w-5 h-5" style={{ color: '#fbbf24' }} />
      <span className="font-mono text-xs font-bold" style={{ color: scoreColor }}>
        {TAG_AUDIT_SCORE}%
      </span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function TagAuditCompact() {
  const { selection } = useDzinSelection();

  return (
    <div className="space-y-1.5 p-2 text-xs">
      {TAG_AUDIT_CATEGORIES.map((cat) => {
        // Audit categories map to tag prefixes; check if any related tag starts with this category name
        const isRelated = !selection || selection.type !== 'tag' || selection.id.startsWith(cat.name);
        return (
          <motion.div
            key={cat.name}
            className="flex items-center gap-2"
            animate={{ opacity: selection && !isRelated ? 0.4 : 1 }}
            transition={{ duration: DZIN_TIMING.HIGHLIGHT }}
          >
            <span
              className="text-[10px] font-mono font-bold px-1 py-0.5 rounded flex-shrink-0"
              style={{ backgroundColor: `${statusColor(cat.status)}20`, color: statusColor(cat.status) }}
            >
              {statusIcon(cat.status)}
            </span>
            <span className="font-medium text-text">{cat.name}</span>
            <span className="ml-auto font-mono text-text-muted">{cat.count}</span>
          </motion.div>
        );
      })}
      <div className="border-t border-border/40 pt-1.5 text-text-muted font-mono">
        Score: {TAG_AUDIT_SCORE}%
      </div>
    </div>
  );
}

/* ── Tag Quick-View Popover ────────────────────────────────────────────── */

function TagQuickViewCard({ tag, detail }: { tag: string; detail: TagDetail }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="bg-surface border border-border/40 rounded-lg p-3 mt-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: detail.color }} />
          <span className="text-xs font-bold text-text">{detail.name}</span>
          <span className="text-[10px] font-mono text-text-muted ml-auto bg-surface-deep px-1.5 py-0.5 rounded border border-border/40">{detail.prefix}</span>
        </div>
        <div className="space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span className="font-mono text-text-muted">Tag</span>
            <span className="font-mono font-bold text-text">{tag}</span>
          </div>
          {detail.cooldown && (
            <div className="flex justify-between">
              <span className="font-mono text-text-muted">Cooldown</span>
              <span className="font-mono font-bold" style={{ color: '#f59e0b' }}>{detail.cooldown}</span>
            </div>
          )}
        </div>
        {detail.blockingTags.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Blocked By</div>
            <div className="flex flex-wrap gap-1">
              {detail.blockingTags.map(bt => (
                <span key={bt} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                  {bt}
                </span>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Lifecycle</div>
          <PipelineFlow steps={detail.lifecycle} accent={detail.color} />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function TagAuditFull() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const maxUsage = Math.max(...TAG_USAGE_FREQUENCY.map(t => t.count));

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag(prev => prev === tag ? null : tag);
  }, []);

  return (
    <div className="space-y-2.5">
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <SectionLabel icon={ClipboardCheck} label="Tag Audit Dashboard" color="#fbbf24" />

        {/* Audit score */}
        <div className="flex items-center gap-2.5 mt-2.5 mb-3">
          <div className="relative w-12 h-12">
            <svg width={48} height={48} viewBox="0 0 48 48">
              <circle cx={24} cy={24} r={20} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
              <circle
                cx={24} cy={24} r={20} fill="none"
                stroke={TAG_AUDIT_SCORE >= 80 ? STATUS_SUCCESS : TAG_AUDIT_SCORE >= 60 ? STATUS_WARNING : STATUS_ERROR}
                strokeWidth={4}
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - TAG_AUDIT_SCORE / 100)}
                strokeLinecap="round"
                transform="rotate(-90 24 24)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-mono font-bold" style={{ color: STATUS_SUCCESS }}>{TAG_AUDIT_SCORE}</span>
            </div>
          </div>
          <div>
            <div className="text-sm font-bold text-text">Overall Audit Score</div>
            <div className="text-xs text-text-muted">{TAG_AUDIT_SCORE}/100 - Good health</div>
          </div>
        </div>

        {/* Audit categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {TAG_AUDIT_CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-surface-deep border rounded-lg p-3"
              style={{ borderColor: `${statusColor(cat.status)}30` }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono font-bold text-text">{cat.name}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${statusColor(cat.status)}20`, color: statusColor(cat.status) }}
                >
                  {statusIcon(cat.status)}
                </span>
              </div>
              <div className="text-lg font-mono font-bold mb-1" style={{ color: statusColor(cat.status) }}>{cat.count}</div>
              <div className="text-[10px] text-text-muted leading-tight">{cat.detail}</div>
            </motion.div>
          ))}
        </div>

        {/* Tag usage frequency */}
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Tag Usage Frequency (Top 10)</div>
        <div className="space-y-1.5">
          {TAG_USAGE_FREQUENCY.map((item, i) => {
            const detail = TAG_DETAIL_MAP[item.tag];
            const barColor = detail?.color ?? '#f59e0b';
            return (
              <div key={item.tag}>
                <motion.button
                  type="button"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 w-full text-left rounded-sm transition-colors hover:bg-surface-hover/40 cursor-pointer"
                  style={selectedTag === item.tag ? { backgroundColor: `${barColor}10` } : undefined}
                  onClick={() => handleTagClick(item.tag)}
                >
                  <span className="text-[10px] font-mono text-text-muted w-36 truncate flex-shrink-0 text-right">{item.tag}</span>
                  <div className="flex-1 h-4 bg-surface-deep/50 rounded-sm overflow-hidden border border-border/30">
                    <motion.div
                      className="h-full rounded-sm"
                      style={{ backgroundColor: barColor, width: `${(item.count / maxUsage) * 100}%`, opacity: 0.7 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.count / maxUsage) * 100}%` }}
                      transition={{ delay: i * 0.04 + 0.2, duration: 0.4 }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-text w-6 text-right">{item.count}</span>
                </motion.button>
                <AnimatePresence>
                  {selectedTag === item.tag && detail && (
                    <TagQuickViewCard tag={item.tag} detail={detail} />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main TagAuditPanel ────────────────────────────────────────────────── */

export function TagAuditPanel({ featureMap: _featureMap, defs: _defs }: TagAuditPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Tag Audit" icon={<ClipboardCheck className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DZIN_TIMING.DENSITY / 2 }}
        >
          {density === 'micro' && <TagAuditMicro />}
          {density === 'compact' && <TagAuditCompact />}
          {density === 'full' && <TagAuditFull />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
