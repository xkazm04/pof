'use client';

import type { LabTheme } from './theme';
import { LabButton } from './steps/controls';
import { useCatalogStore } from '@/stores/catalogStore';
import type { SeedFinding, SeedFindingVerdict } from '@/lib/catalog/seedSync';

/** Why each finding asks instead of following the code — the closed vocabulary of `seedSync.ts`. */
const VERDICT_COPY: Record<SeedFindingVerdict, string> = {
  unrecorded: 'unrecorded — saved before this browser recorded which seed it copied: a stale copy or your edit, nothing tells them apart',
  conflict: 'conflict — edited in this browser, and the shipped seed has changed since',
  orphaned: 'orphaned — the code no longer ships this seed',
};

function findingLine(f: SeedFinding): string {
  const note = f.verdict === 'orphaned' ? (f.removed ? ' (untouched copy removed)' : ' (edited copy kept)') : '';
  return `${f.catalogId} / ${f.name}${note}`;
}

/**
 * The browser's seed drift, stated and decided — never a silent rewrite. The lab resolves
 * entities from this browser's store while the server resolves them from code, so a copy that
 * differs from the shipped seed makes the lab preview and grade content the server no longer
 * holds. Untouched copies already followed the code on load; these are the ones that cannot be
 * decided without you.
 */
export function SeedDriftNotice({ t }: { t: LabTheme }) {
  const drift = useCatalogStore((s) => s.seedDrift);
  const adopt = useCatalogStore((s) => s.adoptShippedSeeds);
  const keep = useCatalogStore((s) => s.keepMine);
  if (drift.length === 0) return null;

  const refs = drift.map((f) => ({ catalogId: f.catalogId, entityId: f.entityId }));
  const byVerdict = new Map<SeedFindingVerdict, SeedFinding[]>();
  for (const f of drift) byVerdict.set(f.verdict, [...(byVerdict.get(f.verdict) ?? []), f]);

  return (
    <section data-testid="seed-drift-notice" aria-label="Seed drift"
      style={{ flexShrink: 0, border: `1px solid ${t.warn}`, borderRadius: t.glass ? 8 : 0, margin: '0 var(--lab-s3) var(--lab-s3)', padding: 'var(--lab-s3)' }}>
      <p className={t.fontBody} style={{ fontSize: 14, color: t.text, margin: '0 0 8px', lineHeight: 1.45 }}>
        {drift.length} {drift.length === 1 ? 'entity' : 'entities'} in this browser differ from the shipped seed. The lab
        previews and grades this copy; the server uses the shipped seed.
      </p>
      <details className={t.fontMono} style={{ fontSize: 13, color: t.muted, marginBottom: 10 }}>
        <summary style={{ cursor: 'pointer' }}>Which, and why</summary>
        {[...byVerdict].map(([verdict, fs]) => (
          <div key={verdict} style={{ marginTop: 8 }}>
            <div style={{ color: t.warn }}>{fs.length} {VERDICT_COPY[verdict]}</div>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, overflowWrap: 'anywhere' }}>
              {fs.map((f) => <li key={`${f.catalogId}/${f.entityId}`}>{findingLine(f)}</li>)}
            </ul>
          </div>
        ))}
      </details>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <LabButton t={t} testId="seed-drift-adopt" onClick={() => adopt(refs)}>Adopt shipped</LabButton>
        <LabButton t={t} testId="seed-drift-keep" onClick={() => keep(refs)}>Keep mine</LabButton>
      </div>
    </section>
  );
}
