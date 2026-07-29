'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRovingFocus } from './hooks/useRovingFocus';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';

type NodeStatus = 'pass' | 'fail' | 'deferred' | 'pending' | 'unproduced';
/** What a dot reads as when the server fetch FAILED and nothing local covers the step. */
const UNKNOWN_TOOLTIP = 'Server status unknown — the artifact fetch failed, so this step is not necessarily unproduced';
/** What a shimmering dot reads as: the caller's `tooltipFor` can only see the pre-fetch
 *  status (`unproduced`/`pending`) and would contradict the rail's own loading treatment. */
const LOADING_TOOLTIP = 'Loading server status…';
const pad2 = (n: number) => String(n).padStart(2, '0');
const STATUS_GLYPH = (s: NodeStatus): string =>
  s === 'pass' ? '✓' : s === 'fail' ? '!' : s === 'deferred' ? '⋯' : s === 'unproduced' ? '·' : '';

interface PipelineRailProps {
  steps: string[];
  stepIdx: number | null;
  displayStatus: (step: string, i: number) => NodeStatus;
  /** Server verdicts are still loading: steps of unknown (pending) status shimmer
   *  instead of reading as an honest "nothing done yet". Locally-known statuses stay. */
  loading?: boolean;
  /**
   * The server artifact fetch FAILED — the reason, verbatim. Steps with no local verdict
   * read as `unknown` (not `unproduced`), and the rail offers a retry: a dead server must
   * never render as an honest "nothing has run here".
   */
  error?: string | null;
  /** Retry the failed artifact fetch (paired with {@link PipelineRailProps.error}). */
  onRetryLoad?: () => void;
  /** The step's local verdict has drifted from server truth (add-only kept local) —
   *  flag it so the operator can adopt the server verdict from the work canvas. */
  hasDrift?: (step: string, i: number) => boolean;
  /** The step's last produce failed to write through to the server (offline/500) — the
   *  local artifact is optimistic-only, so flag it as "not synced to server". */
  syncFailed?: (step: string, i: number) => boolean;
  /** The REASON that write-through failed (server message / rejected fields / no sink), so
   *  the flag is actionable on hover instead of a bare "not synced". */
  syncFailedReason?: (step: string, i: number) => string | null | undefined;
  /** The step's last produce attempt FAILED and the store recorded the reason
   *  (`LabStepArtifact.error`) — flag it so the failure survives leaving the step,
   *  instead of living only in the Produce panel's inline message. */
  produceFailed?: (step: string, i: number) => boolean;
  isLive: (step: string) => boolean;
  tooltipFor: (step: string, i: number) => string;
  ariaFor: (step: string, i: number) => string;
  onSelectStep: (i: number) => void;
}

export function PipelineRail({
  steps,
  stepIdx,
  displayStatus,
  loading = false,
  error = null,
  onRetryLoad,
  hasDrift,
  syncFailed,
  syncFailedReason,
  produceFailed,
  isLive,
  tooltipFor,
  ariaFor,
  onSelectStep,
}: PipelineRailProps) {
  const reduce = useReducedMotion();
  const roving = useRovingFocus(steps.length, stepIdx ?? 0, onSelectStep);
  // Keep the roving cursor synced to the externally-selected step
  // (render-phase bail-out, not an effect).
  const want = stepIdx ?? 0;
  const [prevWant, setPrevWant] = useState(want);
  if (want !== prevWant) {
    setPrevWant(want);
    roving.setActive(want);
  }

  // Roving tabindex moves the ACTIVE index (which item is the tab-stop); DOM focus has to
  // follow it or an Arrow/j/k press moves nothing a keyboard user can see, and the visible
  // focus ring is left on an item that is no longer the tab-stop. Only move focus when the
  // rail already owns it — never steal it on mount or on an external step selection.
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIdx = roving.active;
  useEffect(() => {
    const el = itemRefs.current[activeIdx];
    if (!el || el === document.activeElement) return;
    if (itemRefs.current.some((n) => n !== null && n === document.activeElement)) el.focus();
  }, [activeIdx]);

  const railStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: '4px 18px 18px',
    position: 'relative',
  };

  // A failed fetch names itself and offers a retry (shared InlineErrorRetry), so the
  // dots below are read as "unknown", not as an honest empty pipeline.
  const errorBanner = error ? (
    <div data-testid="rail-load-error" style={{ padding: '0 18px 8px' }}>
      <InlineErrorRetry
        dense
        message={`Couldn't load server status: ${error}`}
        onRetry={() => onRetryLoad?.()}
      />
    </div>
  ) : null;

  // Honest empty state — without it an entity with no pipeline renders as a bare
  // connector line with nothing on it, which reads as a broken panel rather than "none".
  if (steps.length === 0) {
    return (
      <>
      {errorBanner}
      <div
        role="list"
        aria-label="Pipeline steps"
        style={{ ...railStyle, display: 'grid', placeItems: 'center', padding: '24px 18px' }}
      >
        <p
          style={{
            margin: 0,
            maxWidth: 240,
            textAlign: 'center',
            fontSize: 'var(--lab-fs-sm)',
            lineHeight: 1.4,
            color: 'var(--lab-muted)',
          }}
        >
          No pipeline steps here yet — pick a catalog entity in the tree to load its pipeline.
        </p>
      </div>
      </>
    );
  }

  return (
    <>
    {errorBanner}
    <div
      role="list"
      aria-label="Pipeline steps"
      aria-busy={loading || undefined}
      data-arts-error={error ? 'true' : undefined}
      {...roving.containerProps}
      style={railStyle}
    >
      <div
        style={{
          position: 'absolute',
          left: 27,
          top: 12,
          bottom: 22,
          width: 2,
          background: 'var(--lab-line)',
        }}
      />
      {steps.map((step, i) => {
        const status = displayStatus(step, i);
        const current = i === stepIdx;
        const live = isLive(step);
        // Loading only applies where we have NO real verdict yet (pending / unproduced) —
        // a locally-known pass/fail/deferred is real truth and must not be masked by a shimmer.
        const isLoading = loading && (status === 'pending' || status === 'unproduced');
        // No server truth AND no local verdict → the honest reading is "unknown", never
        // "unproduced" (which would invite re-producing over work that exists server-side).
        const unknown = !!error && !isLoading && (status === 'pending' || status === 'unproduced');
        const drifted = hasDrift?.(step, i) ?? false;
        const notSynced = syncFailed?.(step, i) ?? false;
        const notSyncedWhy = (notSynced && syncFailedReason?.(step, i)) || null;
        const produceBroke = produceFailed?.(step, i) ?? false;
        const filled = status === 'pass' || status === 'fail';
        const fill = filled
          ? `var(--lab-${status === 'pass' ? 'ok' : 'bad'})`
          : 'var(--lab-bg)';
        const borderColor = current
          ? 'var(--lab-ink)'
          : status === 'pass'
          ? 'var(--lab-ok)'
          : status === 'fail'
          ? 'var(--lab-bad)'
          : status === 'deferred'
          ? 'var(--lab-deferred)'
          : 'var(--lab-line)';
        // `unproduced` is the faintest node: a dotted hollow dot, dimmer than pending's
        // solid hollow ring — a distinct, colorblind-safe "nothing produced here yet" cue.
        const borderStyle = status === 'deferred' ? 'dashed' : status === 'unproduced' ? 'dotted' : 'solid';
        const glyph = unknown ? '?' : STATUS_GLYPH(status);
        const glyphColor = unknown
          ? 'var(--lab-warn)'
          : filled
          ? 'var(--lab-on-accent)'
          : status === 'deferred' || status === 'unproduced'
          ? 'var(--lab-muted)'
          : 'var(--lab-ink)';
        // An explicit aria-label REPLACES the button's descendant text for assistive tech,
        // so every badge rendered inside it (live dot, drift, sync failure, shimmer) is
        // silent unless folded in here. Keep the order: name+status first, then flags.
        const label = [
          unknown ? `${step}: server status unknown` : ariaFor(step, i),
          isLoading ? 'status loading' : null,
          live ? 'prototyped' : null,
          drifted ? 'server verdict differs' : null,
          notSynced ? 'not synced to server' : null,
          produceBroke ? 'last produce failed' : null,
        ]
          .filter(Boolean)
          .join(', ');

        return (
          <motion.div key={step} role="listitem"
            initial={reduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reduce ? 0 : i * 0.02, duration: reduce ? 0 : 0.16 }}>
          <button
            {...roving.itemProps(i)}
            ref={(el) => { itemRefs.current[i] = el; }}
            onClick={() => onSelectStep(i)}
            title={unknown ? UNKNOWN_TOOLTIP : isLoading ? LOADING_TOOLTIP : tooltipFor(step, i)}
            aria-label={label}
            aria-current={current ? 'step' : undefined}
            className="focus-ring-inset"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              textAlign: 'left',
              padding: '7px 0',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              position: 'relative',
              transition: 'color var(--lab-dur-fast) var(--lab-ease)',
            }}
          >
            <span
              data-step-status={unknown ? 'unknown' : status}
              data-loading={isLoading ? 'true' : undefined}
              className={isLoading && !reduce ? 'lab-shimmer' : status === 'fail' ? 'animate-pulse-glow' : undefined}
              style={{
                width: 20,
                height: 20,
                flexShrink: 0,
                zIndex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isLoading ? (reduce ? 'var(--lab-line)' : undefined) : fill,
                border: `2px ${isLoading ? 'solid var(--lab-line)' : `${borderStyle} ${borderColor}`}`,
                opacity: !isLoading && !unknown && status === 'unproduced' && !current ? 0.55 : 1,
                boxShadow: current ? `0 0 0 3px var(--lab-accent-bg)` : 'none',
                color: glyphColor,
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1,
                transition:
                  'background-color var(--lab-dur-fast) var(--lab-ease), border-color var(--lab-dur-fast) var(--lab-ease)',
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`${step}-${status}`}
                  data-testid={`step-dot-stamp-${i}`}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  {glyph}
                </motion.span>
              </AnimatePresence>
            </span>
            <span
              style={{
                fontSize: 'var(--lab-fs-md)',
                lineHeight: 1.25,
                color: live
                  ? current
                    ? 'var(--lab-ink-deep)'
                    : 'var(--lab-text)'
                  : 'var(--lab-muted)',
                fontWeight: current ? 700 : live ? 500 : 400,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--lab-font-mono)',
                  color: 'var(--lab-muted)',
                  fontSize: 'var(--lab-fs-xs)',
                }}
              >
                {pad2(i + 1)}
              </span>
              {step}
              {live && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: 'var(--lab-ok)',
                    flexShrink: 0,
                  }}
                  title="Prototyped"
                />
              )}
              {drifted && (
                <span
                  data-step-drift="true"
                  aria-hidden="true"
                  title="Server verdict differs — open this step to adopt server truth"
                  style={{
                    flexShrink: 0,
                    fontFamily: 'var(--lab-font-mono)',
                    fontSize: 'var(--lab-fs-xs)',
                    fontWeight: 700,
                    color: 'var(--lab-bad)',
                    lineHeight: 1,
                  }}
                >
                  ≠
                </span>
              )}
              {produceBroke && (
                <span
                  data-step-produce-failed="true"
                  aria-hidden="true"
                  title="Last produce failed — open this step to read the recorded reason"
                  style={{
                    flexShrink: 0,
                    fontFamily: 'var(--lab-font-mono)',
                    fontSize: 'var(--lab-fs-xs)',
                    fontWeight: 700,
                    lineHeight: 1,
                    color: 'var(--lab-bad)',
                  }}
                >
                  ✕
                </span>
              )}
              {notSynced && (
                <span
                  data-step-sync-failed="true"
                  aria-hidden="true"
                  title={notSyncedWhy ?? "Not synced to server — this step's produce failed to save; it may be missing on other devices/sessions"}
                  style={{
                    flexShrink: 0,
                    fontSize: 'var(--lab-fs-xs)',
                    lineHeight: 1,
                    color: 'var(--lab-bad)',
                  }}
                >
                  ⚠
                </span>
              )}
            </span>
          </button>
          </motion.div>
        );
      })}
    </div>
    </>
  );
}
