'use client';

/** One swimlane cell, Blueprint-styled: names the ENGINE powering the step (the step
 *  label moves to the second line + tooltip); the background encodes ONE thing — the
 *  step's position on the production-readiness ladder (`@/lib/status/readiness`).
 *
 *  There used to be a second colour language here: a 3px left stripe painting the
 *  acceptance tier L0–L4. It fought the fill (L4's green and `verified`'s green were the
 *  same token, so green meant "declares a gate" on the stripe and "passed a gate" in the
 *  fill) and it rewarded ambition — a merely DECLARED L4 painted green. The stripe is
 *  gone; the acceptance tier survives as evidence-class metadata in the tooltip, and the
 *  code on the engine line now reads the readiness rung so it never rests on hue alone
 *  (WCAG 1.4.1). `dimmed` supports the highlight chips: non-matching cells drop opacity. */
import { engineSourceMark, type StepCell } from '@/lib/status/statusModel';
import {
  readinessOf,
  readinessCode,
  readinessLabel,
  RAMP,
  BLOCKED_TOKEN,
  BLOCKED_FILL,
} from '@/lib/status/readiness';
import { craftCode, craftLabel } from '@/lib/status/craft';
import type { CellCraft } from '@/lib/craft/craftCell';

export function StatusCell({
  cell,
  dimmed = false,
  craft,
}: {
  cell: StepCell;
  dimmed?: boolean;
  /** The parallel A-axis reading (AAA-craft lens) — display-only, attached by the page
   *  the way realization is; absent = the step was never audited OR gauges failed to
   *  load, and no chip renders (absence is never painted as A0). */
  craft?: CellCraft;
}) {
  const { counts } = cell;
  const readiness = readinessOf(cell);
  // Where the engine NAME came from. The map's whole premise is that a cell says what is
  // behind it, and until now an audited fact, a step-authored declaration and a heuristic
  // guess all printed the same string in the same weight.
  const src = engineSourceMark(cell.engineSource);
  const known = cell.engineSource === 'audited' || cell.engineSource === 'authored';
  const title = [
    `${cell.label} — ${readinessLabel(readiness)}`,
    craft ? `craft: ${craftLabel(craft.craft)} · lens ${craft.lens} · roof ${craft.ceiling}` : '',
    `engine: ${cell.engine} [${src.word}] — ${src.note}`,
    `${cell.tier ? `evidence class ${cell.tier} · ` : ''}internal grade ${cell.grade}`,
    cell.judged
      ? `JUDGED ${cell.judged.verdict.toUpperCase()} ${cell.judged.score}/100 by ${cell.judged.model}: ${cell.judged.findings}`
      : cell.judge ? `judge needed: ${cell.judge}${cell.checkerMeaningful === false ? ' · checker is shape-only' : ''}` : '',
    `pass ${counts.pass} · deferred ${counts.deferred} · pending ${counts.pending} · fail ${counts.fail}`,
    cell.browserMirror ? `browser mirror: ${cell.browserMirror} (step class also runs in the browser preview)` : '',
    cell.realization
      ? `realized: Browser ${cell.realization.browser} · UE ${cell.realization.ue} — ${cell.realization.note}`
      : '',
    cell.auditNote ? `audit: ${cell.auditNote}` : '',
    cell.reason ? `reason: ${cell.reason}` : '',
  ].filter(Boolean).join('\n');

  const unwired = cell.grade === 'unwired';
  // Only mark provenance when the cell actually prints an engine NAME — `—` (unwired) and
  // `no engine` (unpowered) are statements about absence, and stamping them ✓/? would
  // attach a confidence to a claim nobody made.
  const namesEngine = !unwired && cell.grade !== 'unpowered';
  const blocked = readiness.state === 'blocked';
  const waiting = readiness.state === 'waiting';
  const step = RAMP[readiness.level];
  const color = blocked ? BLOCKED_TOKEN : step.token;
  const fill = blocked ? BLOCKED_FILL : step.fill;
  // `waiting` keeps its rung's hue but is never solid: a diagonal hatch over a dashed
  // border reads as "aiming at R4", not "at R4". This is what stops a declared-but-unrun
  // gate from looking like progress — the defect the tier stripe used to create.
  const background = waiting
    ? `repeating-linear-gradient(45deg, color-mix(in srgb, ${color} ${fill}%, transparent) 0 4px, transparent 4px 8px)`
    : fill === 0
      ? 'transparent'
      : `color-mix(in srgb, ${color} ${fill}%, transparent)`;
  return (
    <div
      role="img"
      aria-label={title}
      title={title}
      data-readiness={readiness.level}
      data-readiness-state={readiness.state}
      style={{
        height: 40,
        // 118 before the craft chip joined the meta row; the engine span is the flex:1
        // element that absorbs/releases the extra width.
        width: 132,
        padding: 'var(--lab-s1) var(--lab-s2)',
        // R0 is hollow + dashed so bottlenecks pop; `blocked` and `waiting` take a solid
        // and a dashed frame of their own colour so the state reads at the border too.
        border: unwired
          ? '1px dashed var(--lab-line)'
          : waiting
            ? `1px dashed ${color}`
            : blocked
              ? `1px solid ${color}`
              : `1px solid color-mix(in srgb, ${color} 70%, transparent)`,
        borderRadius: 'var(--lab-r-sm)',
        background,
        color: unwired ? 'var(--text-subtle)' : 'var(--lab-text)',
        fontSize: 'var(--lab-fs-xs)',
        lineHeight: 1.25,
        overflow: 'hidden',
        userSelect: 'none',
        opacity: dimmed ? 0.22 : 1,
        transition: 'opacity var(--lab-dur-fast) var(--lab-ease)',
      }}
    >
      <span style={{ display: 'block', fontFamily: 'var(--lab-font-mono)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cell.browserMirror && (
          // Dual-execution marker: this step class also runs in the browser preview.
          // Glyph (not hue) so it survives colorblind rendering; hollow = partial.
          <span data-testid="browser-mirror-glyph" aria-hidden style={{ marginRight: 3, opacity: 0.85 }}>
            {cell.browserMirror === 'direct' ? '⧉' : '⧠'}
          </span>
        )}
        {cell.label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 400, minWidth: 0 }}>
        {cell.realization && (
          // Realization evidence markers (per-pipeline dual-execution review):
          // B = ran in the Browser preview, U = ran in UE. Solid = proven live,
          // outlined = path exists but never walked, absent = no path.
          // Letter + border style (not hue) so a red judged-fail cell still
          // visibly reads "output RUNS in these targets, quality below bar".
          <span data-testid="realization-markers" style={{ flexShrink: 0, display: 'inline-flex', gap: 2 }}>
            {(['browser', 'ue'] as const).map((target) => {
              const level = cell.realization![target];
              if (level === 'no') return null;
              const letter = target === 'browser' ? 'B' : 'U';
              return (
                <span
                  key={target}
                  data-testid={`realization-${target}-${level}`}
                  style={{
                    fontSize: 8,
                    lineHeight: '10px',
                    width: 11,
                    textAlign: 'center',
                    fontWeight: 700,
                    fontFamily: 'var(--lab-font-mono)',
                    borderRadius: 2,
                    ...(level === 'proven'
                      ? { background: 'var(--lab-ink)', color: 'var(--lab-bg, #fff)' }
                      : { border: '1px dashed var(--lab-ink)', color: 'var(--lab-ink)', opacity: 0.8 }),
                  }}
                >
                  {letter}
                </span>
              );
            })}
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 2, overflow: 'hidden' }}>
          {namesEngine && (
            // Engine PROVENANCE, as a glyph and never as hue (WCAG 1.4.1): ✓ audited fact,
            // ✎ authored by the step, ? nobody knows. An unauthored name is additionally
            // set in italics under a dotted underline, so a guess cannot be mistaken for a
            // fact at a glance the way it was when all three printed identically.
            <span
              data-testid="engine-source-glyph"
              data-engine-source={cell.engineSource ?? 'unsourced'}
              title={`${src.word} — ${src.note}`}
              aria-hidden
              style={{
                flexShrink: 0,
                fontFamily: 'var(--lab-font-mono)',
                fontSize: 9,
                lineHeight: '11px',
                fontWeight: 700,
                opacity: known ? 0.55 : 1,
                color: known ? 'var(--lab-muted)' : 'var(--lab-warn)',
              }}
            >
              {src.glyph}
            </span>
          )}
          <span
            data-testid="engine-name"
            style={{
              flex: 1,
              minWidth: 0,
              opacity: 0.75,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              ...(namesEngine && !known
                ? { fontStyle: 'italic', textDecoration: 'underline dotted', textUnderlineOffset: 2 }
                : null),
            }}
          >
            {unwired ? '—' : cell.grade === 'unpowered' ? 'no engine' : cell.engine}
          </span>
        </span>
        {/* The rung ALSO as text, never hue alone (WCAG 1.4.1) — the fill is the fast
            scan cue, this is the ground truth. `⋯` marks waiting, `✕` blocked, so the
            two non-rung states survive a colorblind or greyscale rendering. */}
        <span
          data-testid="readiness-code"
          title={readinessLabel(readiness)}
          style={{
            flexShrink: 0,
            fontFamily: 'var(--lab-font-mono)',
            fontSize: 11,
            lineHeight: '11px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: blocked ? 'var(--lab-bad)' : unwired ? 'var(--text-subtle)' : 'var(--lab-text)',
          }}
        >
          {readinessCode(readiness)}
        </span>
        {craft && (
          // The PARALLEL craft axis (A0 UNGAUGED → A4 AAA-PARITY): level + state as
          // TEXT (`^` at-ceiling, `~` stale), never hue alone — same WCAG discipline
          // as the readiness code. Colour is secondary reinforcement only: green for
          // a roof reached (achievement), warn for stale, muted otherwise.
          <span
            data-testid="craft-code"
            data-craft={craft.craft.level}
            data-craft-state={craft.craft.state}
            title={`${craftLabel(craft.craft)} · lens ${craft.lens} · roof ${craft.ceiling}`}
            style={{
              flexShrink: 0,
              fontFamily: 'var(--lab-font-mono)',
              fontSize: 9,
              lineHeight: '11px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              color:
                craft.craft.state === 'at-ceiling'
                  ? 'var(--lab-ok)'
                  : craft.craft.state === 'stale'
                    ? 'var(--lab-warn)'
                    : craft.craft.level === 'A0'
                      ? 'var(--text-subtle)'
                      : 'var(--lab-muted)',
            }}
          >
            {craftCode(craft.craft)}
          </span>
        )}
      </span>
    </div>
  );
}
