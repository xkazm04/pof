'use client';

import { useState } from 'react';
import { Button } from './ui/Button';
import { STATUS_GLYPH, STATUS_WORD } from './statusLanguage';
import type { StepDrift } from './hooks/useEntityArtifacts';
import type { LabTheme } from './theme';

interface DriftBannerProps {
  t: LabTheme;
  step: string;
  drift: StepDrift;
  /** The local step carries a candidate-batch archive (data.genHistory) worth protecting. */
  hasHistory: boolean;
  onAdopt: (opts?: { replaceHistory?: boolean }) => void;
}

/**
 * Surfaces server↔local drift for the selected step and offers "adopt server truth".
 * The add-only hydration keeps the local verdict on screen even after the server
 * re-grades, so this banner is the visible, explicit reconciliation path. Adopting
 * preserves the local candidate history by default; replacing it needs an explicit
 * checkbox confirmation, so a re-roll archive is never silently destroyed.
 *
 * Status is named in words (+ glyph), never hue-only, per the StatusToken rule.
 */
export function DriftBanner({ t, step, drift, hasHistory, onAdopt }: DriftBannerProps) {
  const [replaceHistory, setReplaceHistory] = useState(false);
  return (
    <div
      role="status"
      data-testid="drift-banner"
      data-step={step}
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        padding: '10px 14px', margin: '0 0 16px',
        border: `1px solid ${t.bad}`, borderLeft: `3px solid ${t.bad}`,
        borderRadius: t.glass ? 8 : 0, background: 'var(--lab-panel)',
      }}
    >
      <span aria-hidden style={{ color: t.bad, fontWeight: 700 }}>⚠</span>
      <span style={{ fontSize: 14, color: t.text }} data-drift-kind={drift.kind}>
        {drift.kind === 'status' ? (
          <>
            Server truth differs for this step — local reads{' '}
            <strong style={{ color: t.inkDeep }}>{STATUS_GLYPH[drift.local]} {STATUS_WORD[drift.local]}</strong>, server has{' '}
            <strong style={{ color: t.inkDeep }}>{STATUS_GLYPH[drift.server]} {STATUS_WORD[drift.server]}</strong>.
          </>
        ) : (
          <>
            Server CONTENT differs for this step — both read{' '}
            <strong style={{ color: t.inkDeep }}>{STATUS_GLYPH[drift.server]} {STATUS_WORD[drift.server]}</strong>, but the
            produced data is not the same. The verdicts agree, so nothing else would have told you.
          </>
        )}
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {hasHistory && (
          <label className={t.fontMono} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.muted, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={replaceHistory}
              onChange={(e) => setReplaceHistory(e.target.checked)}
              data-testid="drift-replace-history"
            />
            also replace candidate history
          </label>
        )}
        <Button
          variant="accent" mono
          data-testid="drift-adopt"
          onClick={() => onAdopt(replaceHistory ? { replaceHistory: true } : undefined)}
        >
          Adopt server truth
        </Button>
      </div>
    </div>
  );
}
