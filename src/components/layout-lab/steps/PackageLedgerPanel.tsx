'use client';

import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { StatusTag } from '@/components/ui/StatusTag';
import type { StatusLevel } from '@/lib/status-token';
import type { PackageManifest } from '@/lib/catalog/packaging/packageArtifacts';
import type { LedgerBlocker, LedgerState, LedgerUnverified, PackageLedger } from '@/lib/catalog/packaging/packageLedger';
import { DataTable } from './shared/DataTable';
import { LabButton } from './controls';
import type { LabTheme } from '../theme';

/** What `GET /api/pipeline-artifacts/package` returns. */
export interface PackageView {
  step: string;
  stored: { status: string; tier?: string; reason?: string };
  /** The status the one writer (`verify-packaging` POST) would store now. */
  verdict: string;
  verdictReason?: string;
  manifest: Pick<PackageManifest, 'files' | 'missing' | 'ueDeclarations'>;
  ledger: PackageLedger;
}

const STATE: Record<LedgerState, { level: StatusLevel; word: string; line: string }> = {
  ready: { level: 'ok', word: 'ready', line: 'Every referenced output is on disk and every staged file comes from a step that passes.' },
  blocked: { level: 'bad', word: 'blocked', line: 'The ship gate cannot pass yet — the steps below owe it.' },
  'declarations-only': { level: 'warn', word: 'empty', line: 'No sibling has produced a file yet — the package holds UE declarations only.' },
};

const KIND: Record<LedgerBlocker['kind'], string> = {
  'missing-file': 'missing file · disk',
  'unrealized-declaration': 'unrealized declaration · UE Content',
};

/** The deciding layer, or the marker a held row's reason leads with (`TEMPLATE:`, `SOURCED:`, …). */
function layerOf(u: LedgerUnverified): string {
  return /^([A-Z][A-Z_-]{2,}):/.exec(u.reason ?? '')?.[1] ?? u.source;
}

/** The stored-vs-rebuilt line — honest about what "Rebuild package" would change. */
export function verdictLine(v: Pick<PackageView, 'stored' | 'verdict'>): string {
  const head = `stored ${v.stored.status} · rebuilt ${v.verdict}`;
  return v.stored.status === v.verdict ? `${head} — in sync` : `${head} — Rebuild records it`;
}

const qs = (catalogId: string, entityId: string) => new URLSearchParams({ catalogId, entityId }).toString();

/**
 * "Package on disk" — the UE Packaging step's REAL package beside its hand-typed View list:
 * whether the ship gate can pass, which sibling owes each blocker (missing file, unrealized
 * `/Game` declaration, or staged content its own step has not passed), the staged files, and
 * the stored vs rebuilt verdict. Loaded on demand. "Check package" re-reads it (it writes no
 * verdict, but DOES rebuild `generated/packages/<catalog>/<entity>/` on disk); "Rebuild package"
 * POSTs the scoped verify-packaging sweep — the one writer — then re-reads.
 */
export function PackageLedgerPanel({ t, catalogId, entityId }: { t: LabTheme; catalogId: string; entityId: string }) {
  const [view, setView] = useState<PackageView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (rebuild: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (rebuild) {
        await apiFetch('/api/pipeline-artifacts/verify-packaging', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalogId, entityId }),
        });
      }
      setView(await apiFetch<PackageView>(`/api/pipeline-artifacts/package?${qs(catalogId, entityId)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Package read failed');
    } finally {
      setBusy(false);
    }
  }, [catalogId, entityId]);

  const muted = { fontSize: 13, color: t.muted, lineHeight: 1.5 } as const;
  const row = { fontSize: 14, color: t.text, padding: '4px 0', borderTop: `1px solid ${t.line}` } as const;
  const ledger = view?.ledger;
  const unrealized = view?.manifest.ueDeclarations.filter((d) => d.realized === false) ?? [];

  return (
    <div data-testid="package-ledger" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <LabButton t={t} onClick={() => void run(false)} disabled={busy} testId="package-ledger-check">Check package</LabButton>
        <LabButton t={t} onClick={() => void run(true)} disabled={busy} testId="package-ledger-rebuild">Rebuild package</LabButton>
      </div>
      <span style={muted}>
        Both rebuild the package files under generated/packages on disk. Only Rebuild package records the verdict.
      </span>
      {busy && <span style={muted}>Reading the package…</span>}
      {error && <span role="alert" style={{ fontSize: 14, color: t.bad }}>Could not read the package: {error}</span>}
      {view && ledger && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusTag level={STATE[ledger.state].level} word={STATE[ledger.state].word} />
            <span style={{ fontSize: 14, color: t.text }}>{STATE[ledger.state].line}</span>
          </div>
          <span data-testid="package-ledger-verdicts" className={t.fontMono} style={{ fontSize: 14, color: t.text }}>
            {verdictLine(view)}
          </span>
          {view.verdictReason && <span style={muted}>{view.verdictReason}</span>}
          {(ledger.blockers.length > 0 || ledger.unverified.length > 0) && (
            <div data-testid="package-ledger-blockers">
              {ledger.blockers.map((b, i) => (
                <div key={`b${i}`} style={row}>
                  <span className={t.fontMono}>{`${b.step} (${KIND[b.kind]})`}</span>
                  <span style={{ color: t.muted }}>{` ×${b.count} — ${b.reason}`}</span>
                </div>
              ))}
              {ledger.unverified.map((u) => (
                <div key={`u${u.step}`} style={row}>
                  <span className={t.fontMono}>{`${u.step} (${u.status} · ${layerOf(u)})`}</span>
                  <span style={{ color: t.muted }}>{` ${u.files} staged file${u.files === 1 ? '' : 's'} not passed by its own step${u.reason ? ` — ${u.reason}` : ''}`}</span>
                </div>
              ))}
            </div>
          )}
          {view.manifest.files.length > 0 ? (
            <DataTable t={t} testId="package-ledger-files" columns={[{ key: 'name' }, { key: 'origin' }, { key: 'bytes' }, { key: 'sha1' }]}
              caption={`${ledger.staged} staged file${ledger.staged === 1 ? '' : 's'} · UE declarations: ${ledger.declarations}`}
              rows={view.manifest.files.map((f) => ({ label: f.sourceStep, values: { name: f.name, origin: f.origin, bytes: f.bytes, sha1: f.sha1.slice(0, 10) } }))} />
          ) : (
            <span style={muted}>No files staged · UE declarations: {ledger.declarations}</span>
          )}
          {unrealized.length > 0 && (
            <span className={t.fontMono} style={{ fontSize: 13, color: t.warn }}>
              Not realized in Content/: {unrealized.map((d) => d.path).join(', ')}
            </span>
          )}
        </>
      )}
    </div>
  );
}
