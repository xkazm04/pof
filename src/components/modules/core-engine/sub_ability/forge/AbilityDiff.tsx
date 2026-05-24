'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  GitCompareArrows, ArrowRight, Plus, Minus, Gauge, Shield, Code2,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_EMERALD, STATUS_WARNING, ACCENT_CYAN, ACCENT_RED, ACCENT_GREEN,
  OVERLAY_WHITE, OPACITY_3, OPACITY_8, OPACITY_10, withOpacity,
} from '@/lib/chart-colors';
import { groupDeltas } from '@/lib/genome/genome-diff';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';
import { ACCENT } from './constants';
import {
  diffAbilityStats, diffAbilityTags, diffLines, summarizeLines, collapseDiff,
  abilityHasChanges, type DiffRow,
} from './ability-diff';

/* ── Refinement diff: what the last follow-up changed ────────────────── *
 * Side-by-side preview of the stat / tag / code deltas between the prior
 * ability and the refined one, so a refine is auditable rather than an
 * opaque swap.
 * ────────────────────────────────────────────────────────────────────── */

const DIRECTION_COLOR = {
  up: ACCENT_EMERALD,
  down: STATUS_WARNING,
  neutral: ACCENT_CYAN,
} as const;

const LINE_COLOR = { add: ACCENT_GREEN, del: ACCENT_RED, eq: undefined } as const;

export function AbilityDiff({ prior, next, instruction }: {
  prior: ForgedAbility;
  next: ForgedAbility;
  instruction: string;
}) {
  const statGroups = useMemo(() => groupDeltas(diffAbilityStats(prior, next)), [prior, next]);
  const tagChanges = useMemo(() => diffAbilityTags(prior, next), [prior, next]);
  const headerDiff = useMemo(() => diffLines(prior.headerCode, next.headerCode), [prior, next]);
  const cppDiff = useMemo(() => diffLines(prior.cppCode, next.cppCode), [prior, next]);

  const headerChanged = prior.headerCode !== next.headerCode;
  const cppChanged = prior.cppCode !== next.cppCode;
  const anyChange = abilityHasChanges(prior, next);

  return (
    <BlueprintPanel color={ACCENT} className="p-4 space-y-4">
      <div className="flex items-start gap-2">
        <GitCompareArrows size={15} style={{ color: ACCENT }} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-200">What changed</div>
          <div className="text-[11px] text-zinc-500 leading-relaxed">
            Refined <span className="text-zinc-400">{prior.displayName}</span> with
            {' '}“<span className="text-zinc-300">{instruction}</span>”
          </div>
        </div>
      </div>

      {!anyChange && (
        <p className="text-xs font-mono text-zinc-500">
          The refine returned an identical ability — no stat, tag, or code changes detected.
        </p>
      )}

      {/* Stats */}
      {statGroups.length > 0 && (
        <div className="space-y-2">
          <SectionHeader icon={Gauge} label="Stats" color={ACCENT_RED} />
          {statGroups.map(({ group, items }) => (
            <div key={group} className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-600">{group}</div>
              {items.map((d) => (
                <div key={`${group}-${d.label}`} className="flex items-center gap-2 text-xs font-mono pl-1">
                  <span className="flex-1 text-zinc-500 truncate">{d.label}</span>
                  <span className="text-zinc-600">{d.from}</span>
                  <ArrowRight size={11} className="shrink-0" style={{ color: DIRECTION_COLOR[d.direction] }} />
                  <span className="font-semibold" style={{ color: DIRECTION_COLOR[d.direction] }}>{d.to}</span>
                  {d.delta && (
                    <span className="w-16 text-right tabular-nums" style={{ color: DIRECTION_COLOR[d.direction] }}>
                      {d.delta}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {tagChanges.length > 0 && (
        <div className="space-y-2">
          <SectionHeader icon={Shield} label="Tags" color={ACCENT_GREEN} />
          {tagChanges.map((tc) => (
            <div key={tc.group} className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-mono uppercase tracking-[0.15em] text-zinc-600 w-24 shrink-0">{tc.group}</span>
              {tc.removed.map((t) => (
                <span
                  key={`r-${t}`}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono line-through"
                  style={{ color: ACCENT_RED, background: withOpacity(ACCENT_RED, OPACITY_8) }}
                >
                  <Minus size={10} /> {t}
                </span>
              ))}
              {tc.added.map((t) => (
                <span
                  key={`a-${t}`}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono"
                  style={{ color: ACCENT_GREEN, background: withOpacity(ACCENT_GREEN, OPACITY_8) }}
                >
                  <Plus size={10} /> {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Code */}
      {(headerChanged || cppChanged) && (
        <div className="space-y-2">
          <SectionHeader icon={Code2} label="Code" color={ACCENT} />
          {headerChanged && (
            <CodeDiff filename={`${next.className}.h`} lines={headerDiff} />
          )}
          {cppChanged && (
            <CodeDiff filename={`${next.className}.cpp`} lines={cppDiff} />
          )}
        </div>
      )}
    </BlueprintPanel>
  );
}

/* ── Collapsible unified code diff for one file ──────────────────────── */

function CodeDiff({ filename, lines }: { filename: string; lines: ReturnType<typeof diffLines> }) {
  const [open, setOpen] = useState(false);
  const { added, removed } = summarizeLines(lines);
  const rows = useMemo<DiffRow[]>(() => collapseDiff(lines, 2), [lines]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800 hover:bg-zinc-900 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-zinc-400">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {filename}
        </span>
        <span className="flex items-center gap-2 text-xs font-mono tabular-nums">
          {added > 0 && <span style={{ color: ACCENT_GREEN }}>+{added}</span>}
          {removed > 0 && <span style={{ color: ACCENT_RED }}>−{removed}</span>}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-xs leading-relaxed font-mono bg-zinc-950/50 max-h-[360px] overflow-y-auto custom-scrollbar">
              {rows.map((row, i) =>
                row.type === 'gap' ? (
                  <div
                    key={`gap-${i}`}
                    className="px-3 py-0.5 text-[10px] text-zinc-600 select-none"
                    style={{ background: withOpacity(OVERLAY_WHITE, OPACITY_3) }}
                  >
                    ⋯ {row.count} unchanged line{row.count === 1 ? '' : 's'}
                  </div>
                ) : (
                  <div
                    key={`l-${i}`}
                    className="px-3 whitespace-pre-wrap break-words"
                    style={{
                      color: LINE_COLOR[row.type] ?? 'var(--text-muted)',
                      background:
                        row.type === 'add' ? withOpacity(ACCENT_GREEN, OPACITY_10)
                        : row.type === 'del' ? withOpacity(ACCENT_RED, OPACITY_10)
                        : 'transparent',
                    }}
                  >
                    <span className="select-none text-zinc-600 mr-2">
                      {row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' '}
                    </span>
                    {row.text || ' '}
                  </div>
                ),
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
