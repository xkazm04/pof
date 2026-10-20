'use client';

/**
 * Next-up worklist - a short ranked list of the cells worth opening first, above the lanes.
 * Display only: it renders `buildWorkQueue` and hands the chosen cell to the caller, which
 * opens the existing evidence modal (that modal already lands on the entity holding the step
 * down). Model-blocked items are shown parked and labelled, never as work.
 */
import { useState } from 'react';
import { STATE_GLYPH } from '@/lib/status/readiness';
import type { WorkItem } from '@/lib/status/workQueue';

const SHOWN = 8;

export function WorkQueuePanel({ items, onOpen }: { items: readonly WorkItem[]; onOpen: (item: WorkItem) => void }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, SHOWN);
  const actionable = items.filter((i) => !i.parked).length;
  return (
    <section
      data-testid="work-queue"
      aria-label="Next up"
      style={{
        marginBottom: 'var(--lab-s3)',
        padding: 'var(--lab-s2) var(--lab-s3)',
        fontSize: 'var(--lab-fs-xs)',
        fontFamily: 'var(--lab-font-mono)',
        border: '1px solid var(--lab-line)',
        borderRadius: 'var(--lab-r-sm)',
      }}
    >
      <div style={{ color: 'var(--lab-muted)', marginBottom: 'var(--lab-s1)' }}>
        <strong style={{ color: 'var(--lab-text)' }}>Next up</strong> - {actionable} step{actionable === 1 ? '' : 's'} below R3
        to work, {items.length - actionable} parked (model-blocked: recorded, never attempted). Click one to open its evidence.
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
        {shown.map((i) => (
          <li key={`${i.catalogId} ${i.step}`}>
            <button
              type="button"
              className="focus-ring"
              data-queue-item=""
              data-catalog={i.catalogId}
              data-step={i.step}
              title={i.because}
              onClick={() => onOpen(i)}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--lab-s2)',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--lab-s1) 0',
                color: i.parked ? 'var(--lab-muted)' : 'var(--lab-text)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            >
              <span style={{ minWidth: 120, fontWeight: 700, color: i.parked ? 'var(--lab-muted)' : 'var(--lab-ink)' }}>{i.catalogId}</span>
              <span>{i.step}</span>
              <span>
                {i.level}
                {i.state !== 'reached' ? ` ${STATE_GLYPH[i.state]} ${i.state}` : ''}
              </span>
              <span>{i.route}</span>
              {i.parked && <strong>PARKED</strong>}
              <span style={{ color: 'var(--text-subtle)' }}>{i.because}</span>
            </button>
          </li>
        ))}
      </ol>
      {items.length > SHOWN && (
        <button
          type="button"
          className="focus-ring"
          onClick={() => setAll((v) => !v)}
          style={{ marginTop: 'var(--lab-s1)', background: 'transparent', border: 'none', color: 'var(--lab-ink)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline' }}
        >
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}
