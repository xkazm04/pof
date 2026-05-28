'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Download, Cable, ShieldCheck, Loader2 } from 'lucide-react';
import { postArtifact, fetchArtifacts } from '@/components/layout-lab/labArtifactClient';
import { runPython } from '@/lib/bridge/run-python';
import { downloadBlob } from '@/lib/download';
import { usePofBridge } from '@/hooks/usePofBridge';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { STATUS_SUCCESS, STATUS_MUTED, withOpacity, OPACITY_15 } from '@/lib/chart-colors';
import type { AcceptanceTier } from '@/lib/catalog/acceptance/types';
import type { LifecycleState } from '@/lib/catalog/types';
import type { LootFilterRuleset } from '@/lib/loot-filter/types';
import {
  LOOT_FILTER_CATALOG_ID, STEP_GENERATE, STEP_WIRE, STEP_VERIFY, STEP_TIER, deriveLifecycle,
} from '@/lib/loot-filter/pipeline';
import { dataTableAssetPath, rulesetToDataTableRows, rulesetToDataTableJson } from '@/lib/loot-filter/export';

const STAGES: { state: LifecycleState; label: string }[] = [
  { state: 'generated', label: 'Generated' },
  { state: 'wired', label: 'Wired' },
  { state: 'verified', label: 'Verified' },
];
const RANK: Record<LifecycleState, number> = { planned: 0, scaffolded: 0, failed: 0, generated: 1, wired: 2, verified: 3 };

/** A single pipeline-step action button (spinner while its step is running). */
function StepButton({ icon: Icon, label, onClick, disabled, loading, accent }: {
  icon: typeof Download; label: string; onClick: () => void; disabled: boolean; loading: boolean; accent: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-md border border-border/40 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default hover:border-border/80"
      style={{ color: disabled ? undefined : accent }}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}{label}
    </button>
  );
}

/** Exports the ruleset to UE as a DataTable through the pipeline: generate → wire → verify. */
export function ExportPanel({ ruleset, accent }: { ruleset: LootFilterRuleset; accent: string }) {
  const { isConnected } = usePofBridge();
  const port = usePofBridgeStore((s) => s.pofPort);
  const authToken = usePofBridgeStore((s) => s.pofAuthToken);
  const [lifecycle, setLifecycle] = useState<LifecycleState>('planned');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const assetPath = dataTableAssetPath(ruleset);

  // Hydrate lifecycle from the persisted pipeline artifacts (the pipeline truth).
  useEffect(() => {
    let alive = true;
    fetchArtifacts(LOOT_FILTER_CATALOG_ID, ruleset.id).then((arts) => {
      if (!alive) return;
      setLifecycle(deriveLifecycle(Array.isArray(arts) ? arts : []));
      setNote(null);
    });
    return () => { alive = false; };
  }, [ruleset.id]);

  const doGenerate = useCallback(async () => {
    setBusy(STEP_GENERATE);
    const rows = rulesetToDataTableRows(ruleset);
    const json = rulesetToDataTableJson(ruleset);
    await postArtifact({
      catalogId: LOOT_FILTER_CATALOG_ID, entityId: ruleset.id, step: STEP_GENERATE,
      data: { json, rowCount: rows.length, assetPath, name: ruleset.name },
      ueAssets: [assetPath], status: 'pass', tier: STEP_TIER[STEP_GENERATE],
    });
    setLifecycle((cur) => (RANK[cur] > RANK.generated ? cur : 'generated'));
    setNote(`Generated ${rows.length} rows → ${assetPath}`);
    downloadBlob(new Blob([json], { type: 'application/json' }), `${assetPath.split('/').pop()}.json`);
    setBusy(null);
  }, [ruleset, assetPath]);

  const runBridge = useCallback(async (
    step: string, fn: string, tier: AcceptanceTier, okState: LifecycleState, okMsg: string,
  ) => {
    if (!isConnected) {
      setNote(`UE bridge offline — connect the PoF plugin to ${step === STEP_WIRE ? 'wire' : 'verify'} the DataTable.`);
      await postArtifact({ catalogId: LOOT_FILTER_CATALOG_ID, entityId: ruleset.id, step, data: { assetPath }, ueAssets: [assetPath], status: 'deferred', tier, reason: 'UE bridge offline' });
      return;
    }
    setBusy(step);
    const res = await runPython(`${LOOT_FILTER_CATALOG_ID}.exporter`, fn,
      { assetPath, rows: rulesetToDataTableRows(ruleset) },
      { bridgeUrl: `http://localhost:${port}/pof/python/run`, authToken: authToken || undefined });
    if (res.ok) {
      setLifecycle((cur) => (RANK[cur] > RANK[okState] ? cur : okState));
      setNote(okMsg);
      await postArtifact({ catalogId: LOOT_FILTER_CATALOG_ID, entityId: ruleset.id, step, data: { assetPath }, ueAssets: [assetPath], status: 'pass', tier });
    } else {
      setNote(res.error);
      await postArtifact({ catalogId: LOOT_FILTER_CATALOG_ID, entityId: ruleset.id, step, data: { assetPath }, ueAssets: [assetPath], status: 'deferred', tier, reason: res.error });
    }
    setBusy(null);
  }, [isConnected, ruleset, assetPath, port, authToken]);

  const rank = RANK[lifecycle];
  const anyBusy = busy !== null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StepButton icon={Download} label="Generate DataTable" accent={accent} loading={busy === STEP_GENERATE}
          disabled={anyBusy} onClick={doGenerate} />
        <StepButton icon={Cable} label="Wire to UE" accent={accent} loading={busy === STEP_WIRE}
          disabled={anyBusy || rank < RANK.generated}
          onClick={() => runBridge(STEP_WIRE, 'import_datatable', STEP_TIER[STEP_WIRE], 'wired', 'Imported DataTable into the UE project.')} />
        <StepButton icon={ShieldCheck} label="Verify in PIE" accent={accent} loading={busy === STEP_VERIFY}
          disabled={anyBusy || rank < RANK.wired}
          onClick={() => runBridge(STEP_VERIFY, 'verify', STEP_TIER[STEP_VERIFY], 'verified', 'Filter verified live in PIE.')} />

        <span className="flex-1" />
        <div className="flex items-center gap-1">
          {STAGES.map((st, i) => {
            const reached = rank >= RANK[st.state];
            const c = reached ? STATUS_SUCCESS : STATUS_MUTED;
            return (
              <Fragment key={st.state}>
                {i > 0 && <span className="h-px w-3" style={{ backgroundColor: withOpacity(STATUS_MUTED, OPACITY_15) }} />}
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: c, backgroundColor: withOpacity(c, OPACITY_15) }}>{st.label}</span>
              </Fragment>
            );
          })}
        </div>
      </div>
      {note && <p className="text-[11px] font-mono text-text-muted/80 break-all">{note}</p>}
    </div>
  );
}
