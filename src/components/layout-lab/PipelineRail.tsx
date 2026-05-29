'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRovingFocus } from './hooks/useRovingFocus';

type NodeStatus = 'pass' | 'fail' | 'deferred' | 'pending';
const pad2 = (n: number) => String(n).padStart(2, '0');
const STATUS_GLYPH = (s: NodeStatus): string =>
  s === 'pass' ? '✓' : s === 'fail' ? '!' : s === 'deferred' ? '⋯' : '';

interface PipelineRailProps {
  steps: string[];
  stepIdx: number | null;
  displayStatus: (step: string, i: number) => NodeStatus;
  isLive: (step: string) => boolean;
  tooltipFor: (step: string, i: number) => string;
  ariaFor: (step: string, i: number) => string;
  onSelectStep: (i: number) => void;
}

export function PipelineRail({
  steps,
  stepIdx,
  displayStatus,
  isLive,
  tooltipFor,
  ariaFor,
  onSelectStep,
}: PipelineRailProps) {
  const roving = useRovingFocus(steps.length, stepIdx ?? 0, onSelectStep);
  // Keep the roving cursor synced to the externally-selected step
  // (render-phase bail-out, not an effect).
  const want = stepIdx ?? 0;
  const [prevWant, setPrevWant] = useState(want);
  if (want !== prevWant) {
    setPrevWant(want);
    roving.setActive(want);
  }

  return (
    <div
      role="list"
      aria-label="Pipeline steps"
      {...roving.containerProps}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '4px 18px 18px',
        position: 'relative',
      }}
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
        const glyph = STATUS_GLYPH(status);
        const glyphColor = filled
          ? 'var(--lab-on-accent)'
          : status === 'deferred'
          ? 'var(--lab-muted)'
          : 'var(--lab-ink)';

        return (
          <button
            key={step}
            {...roving.itemProps(i)}
            onClick={() => onSelectStep(i)}
            title={tooltipFor(step, i)}
            aria-label={ariaFor(step, i)}
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
              data-step-status={status}
              className={status === 'fail' ? 'animate-pulse-glow' : undefined}
              style={{
                width: 20,
                height: 20,
                flexShrink: 0,
                zIndex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: fill,
                border: `2px ${status === 'deferred' ? 'dashed' : 'solid'} ${borderColor}`,
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
            </span>
          </button>
        );
      })}
    </div>
  );
}
