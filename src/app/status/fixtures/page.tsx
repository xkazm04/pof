'use client';

/**
 * /status/fixtures — the operator's view of the test residue in their own database, and the
 * one action that removes it.
 *
 * Test suites wrote synthetic entities (`test-headless*`, `item-mcp-smoke`) into the real
 * `~/.pof/pof.db` on every `npm run validate`: measured 2026-08-19, 344 of 817
 * `pipeline_artifacts` were fixtures. `vitest.config.ts` now points the suite at a throwaway
 * DB so the pile stops growing — this page is where the existing pile is inspected and, if the
 * operator chooses, removed.
 *
 * Deliberately two steps. The inventory loads on its own and writes NOTHING; the purge is a
 * separate, confirmed act that echoes back the real per-table `changes()`. Nobody's data gets
 * deleted because a page was opened, and nothing is deleted at boot: an operator may be
 * mid-investigation with exactly these rows on screen.
 */

import { useCallback, useEffect, useState } from 'react';
import { labFontVars } from '@/components/layout-lab/fonts';
import { tryApiFetch } from '@/lib/api-utils';

interface PurgeCounts {
  artifacts: number;
  revisions: number;
  verdicts: number;
  verdictHistory: number;
}
interface FixtureEntity {
  entityId: string;
  catalogIds: string[];
  counts: PurgeCounts;
}
interface FixtureInventory {
  entities: FixtureEntity[];
  total: PurgeCounts;
  purged: boolean;
  totalRows: number;
}

const ENDPOINT = '/api/pipeline-artifacts/purge-fixtures';

/** The four tables a produced step writes into, in the order the report reads them. */
const COLUMNS: { field: keyof PurgeCounts; label: string; table: string }[] = [
  { field: 'artifacts', label: 'Artifacts', table: 'pipeline_artifacts' },
  { field: 'revisions', label: 'Revisions', table: 'pipeline_artifact_revisions' },
  { field: 'verdicts', label: 'Verdicts', table: 'judge_verdicts' },
  { field: 'verdictHistory', label: 'Verdict log', table: 'judge_verdict_history' },
];

const cell = { padding: 'var(--lab-s2)', textAlign: 'right' as const, fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)' };
const headCell = { ...cell, color: 'var(--lab-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600 };

export default function FixturesPage() {
  const [inventory, setInventory] = useState<FixtureInventory | null>(null);
  const [result, setResult] = useState<FixtureInventory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await tryApiFetch<FixtureInventory>(ENDPOINT);
    setLoading(false);
    if (r.ok) setInventory(r.data);
    else setError(r.error);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const purge = useCallback(async () => {
    if (!inventory) return;
    setBusy(true);
    setError(null);
    const r = await tryApiFetch<FixtureInventory>(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectRows: inventory.totalRows }),
    });
    setBusy(false);
    setArmed(false);
    if (r.ok) { setResult(r.data); setInventory(null); void load(); }
    else setError(r.error);
  }, [inventory, load]);

  const shown = result ?? inventory;

  return (
    <main
      data-theme="blueprint"
      data-lab-root=""
      className={labFontVars}
      style={{
        minHeight: '100vh',
        background: 'var(--lab-bg)',
        backgroundImage: 'var(--lab-grid-image)',
        backgroundSize: 'var(--lab-grid-size)',
        color: 'var(--lab-text)',
        fontFamily: 'var(--lab-font-body)',
        padding: 'var(--lab-s6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--lab-s4)', flexWrap: 'wrap', marginBottom: 'var(--lab-s2)' }}>
        <h1 style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xl)', color: 'var(--lab-ink-deep)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Test Fixtures
        </h1>
        <a
          href="/status"
          className="focus-ring"
          style={{ marginLeft: 'auto', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          ← Pipeline status
        </a>
      </div>

      <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', maxWidth: 880, marginBottom: 'var(--lab-s4)' }}>
        Rows in your database that belong to <strong>test harness entities</strong>, not to your project. Every step writes
        into four tables, so a fixture does too — this counts all four. The test suite no longer writes here (it runs
        against a throwaway database), but whatever earlier runs left behind is still counted by anything that reads these
        tables directly. Reading this page changes nothing; the purge below is a separate, confirmed act.
      </p>

      {loading && <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)' }} role="status">Measuring…</p>}

      {error && (
        <div role="alert" data-testid="fixtures-error" style={{ border: '1px solid var(--lab-bad)', padding: 'var(--lab-s3)', marginBottom: 'var(--lab-s4)', fontSize: 'var(--lab-fs-xs)' }}>
          <strong>Nothing was deleted.</strong> {error}{' '}
          <button type="button" className="focus-ring" onClick={() => void load()} style={{ textDecoration: 'underline' }}>Retry</button>
        </div>
      )}

      {result && (
        <div role="status" data-testid="fixtures-purged" style={{ border: '1px solid var(--lab-ink)', padding: 'var(--lab-s3)', marginBottom: 'var(--lab-s4)', fontSize: 'var(--lab-fs-xs)' }}>
          <strong>Removed {rowTotal(result.total)} rows</strong> across {result.entities.length} fixture{result.entities.length === 1 ? '' : ' entities'} —{' '}
          {COLUMNS.map((c) => `${result.total[c.field]} ${c.table}`).join(', ')}. These are the counts the database actually
          reported, not the number attempted.
        </div>
      )}

      {shown && shown.entities.length === 0 && !loading && (
        <p data-testid="fixtures-empty" style={{ fontSize: 'var(--lab-fs-xs)' }}>
          No fixture rows. Nothing to remove.
        </p>
      )}

      {shown && shown.entities.length > 0 && (
        <>
          <table data-testid="fixtures-table" style={{ borderCollapse: 'collapse', marginBottom: 'var(--lab-s4)' }}>
            <caption style={{ textAlign: 'left', fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', paddingBottom: 'var(--lab-s2)' }}>
              {result ? 'Rows removed, per fixture entity and per table.' : 'Rows that would be removed, per fixture entity and per table.'}
            </caption>
            <thead>
              <tr>
                <th scope="col" style={{ ...headCell, textAlign: 'left' }}>Fixture entity</th>
                <th scope="col" style={headCell}>Catalogs</th>
                {COLUMNS.map((c) => (
                  <th key={c.field} scope="col" style={headCell} title={c.table}>{c.label}</th>
                ))}
                <th scope="col" style={headCell}>Total</th>
              </tr>
            </thead>
            <tbody>
              {shown.entities.map((e) => (
                <tr key={e.entityId} style={{ borderTop: '1px solid var(--lab-line)' }}>
                  <th scope="row" style={{ ...cell, textAlign: 'left', color: 'var(--lab-ink-deep)', fontWeight: 500 }}>{e.entityId}</th>
                  <td style={cell}>{e.catalogIds.length}</td>
                  {COLUMNS.map((c) => <td key={c.field} style={cell}>{e.counts[c.field]}</td>)}
                  <td style={{ ...cell, color: 'var(--lab-ink-deep)', fontWeight: 600 }}>{rowTotal(e.counts)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--lab-ink)' }}>
                <th scope="row" style={{ ...cell, textAlign: 'left', color: 'var(--lab-ink-deep)', fontWeight: 600 }}>All fixtures</th>
                <td style={cell} />
                {COLUMNS.map((c) => <td key={c.field} style={{ ...cell, fontWeight: 600 }}>{shown.total[c.field]}</td>)}
                <td style={{ ...cell, color: 'var(--lab-ink-deep)', fontWeight: 700 }}>{rowTotal(shown.total)}</td>
              </tr>
            </tbody>
          </table>

          {!result && inventory && (
            armed ? (
              <div style={{ display: 'flex', gap: 'var(--lab-s3)', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--lab-fs-xs)' }}>
                  Permanently delete <strong>{inventory.totalRows}</strong> rows? This cannot be undone.
                </span>
                <button
                  type="button"
                  className="focus-ring"
                  data-testid="fixtures-purge-confirm"
                  disabled={busy}
                  onClick={() => void purge()}
                  style={{ border: '1px solid var(--lab-bad)', color: 'var(--lab-bad)', padding: 'var(--lab-s2) var(--lab-s3)', fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)' }}
                >
                  {busy ? 'Deleting…' : `Yes, delete ${inventory.totalRows} rows`}
                </button>
                <button type="button" className="focus-ring" onClick={() => setArmed(false)} style={{ fontSize: 'var(--lab-fs-xs)', textDecoration: 'underline' }}>Cancel</button>
              </div>
            ) : (
              <button
                type="button"
                className="focus-ring"
                data-testid="fixtures-purge"
                onClick={() => setArmed(true)}
                style={{ border: '1px solid var(--lab-ink)', color: 'var(--lab-ink-deep)', padding: 'var(--lab-s2) var(--lab-s3)', fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)' }}
              >
                Purge {inventory.totalRows} fixture rows…
              </button>
            )
          )}
        </>
      )}
    </main>
  );
}

function rowTotal(c: PurgeCounts): number {
  return c.artifacts + c.revisions + c.verdicts + c.verdictHistory;
}
