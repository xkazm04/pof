import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { connectMcp, backendReachable, ORIGIN, type McpHandle } from './harness.js';
import { UE_ROOT, UE_MODULE, GARDEN, GROWTH_LOG, BASELINE_FILE } from './growth-garden.js';

/**
 * Layer 3 — UE growth (Goal 3). Drives the connected UE project through the MCP and proves
 * it does not regress (and grows when authored).
 *
 *  Tier 1 (truth ratchet): scans the real UE project on disk via the MCP — needs only the
 *    backend + the project on disk, NO editor. Records a row to GROWTH-LOG.md and asserts
 *    the class/asset counts never drop below the stored baseline.
 *  Tier 2 (editor growth): drains the garden's gates against the LIVE editor — gated on
 *    POF_LIVE_UE=1 and a connected bridge; skips with a reason otherwise (Rule 4).
 */
const LIVE = process.env.POF_LIVE_UE === '1';
const backendUp = await backendReachable();
const tier1Skip = backendUp ? false : `PoF backend not reachable at ${ORIGIN} — start the dev server`;
const tier2Skip = !LIVE
  ? 'POF_LIVE_UE != 1 — editor growth disabled (set it + run the UE editor with the PoF bridge plugin)'
  : backendUp
    ? false
    : `PoF backend not reachable at ${ORIGIN}`;

/** The status route returns {connected:false} when offline, else the full status object
 *  (pluginVersion/editorState…) with NO `connected` field. Detect "online" from that. */
function isBridgeConnected(status: any): boolean {
  return !!(status && status.connected !== false && (status.pluginVersion || status.editorState || status.manifestReady != null));
}

let mcp: McpHandle;
before(async () => {
  mcp = await connectMcp();
});
after(async () => {
  await mcp?.close();
});

function logRow(at: string, classes: number | string, assets: number | string, bridge: string, note: string): void {
  if (!existsSync(GROWTH_LOG)) {
    writeFileSync(
      GROWTH_LOG,
      '# pof-mcp — UE Project Growth Log\n\n' +
        'Appended by the live growth suite (`growth.live.itest.ts`). Each row is a measured\n' +
        'snapshot of the connected UE project, taken through the MCP. Class/asset counts must\n' +
        'never regress; growth is noted.\n\n' +
        '| at | classes | assets | bridge | note |\n|----|---------|--------|--------|------|\n',
    );
  }
  appendFileSync(GROWTH_LOG, `| ${at} | ${classes} | ${assets} | ${bridge} | ${note} |\n`);
}

async function snapshot(): Promise<{ classes: number; assets: number; bridge: string; scanError: string | null }> {
  const proj = await mcp.call('pof_ue_scan_project', { projectPath: UE_ROOT, moduleName: UE_MODULE });
  if (proj.isError) return { classes: 0, assets: 0, bridge: 'offline', scanError: proj.text.slice(0, 160) };
  const assetsRes = (await mcp.call('pof_ue_scan_assets', { projectPath: UE_ROOT })).json;
  const status = (await mcp.call('pof_ue_status')).json;
  const classes = Array.isArray(proj.json?.classes) ? proj.json.classes.length : (proj.json?.classCount ?? 0);
  const assets = Array.isArray(assetsRes?.assets) ? assetsRes.assets.length : (assetsRes?.assetCount ?? 0);
  return { classes, assets, bridge: isBridgeConnected(status) ? 'connected' : 'offline', scanError: null };
}

// ── Tier 1: measure the real project + ratchet non-regression ─────────────────────
test('growth: measure the connected UE project on disk and ratchet non-regression', { skip: tier1Skip }, async (t) => {
  const snap = await snapshot();
  if (snap.scanError) {
    t.skip(`UE project not scannable at ${UE_ROOT} (${snap.scanError}) — set POF_UE_ROOT`);
    return;
  }
  assert.ok(snap.classes > 0, `expected the real UE project to expose C++ classes, got ${snap.classes} (UE_ROOT=${UE_ROOT})`);

  let note = 'baseline';
  if (existsSync(BASELINE_FILE)) {
    const base = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as { classes: number; assets: number };
    assert.ok(snap.classes >= base.classes, `class count regressed: ${snap.classes} < ${base.classes}`);
    assert.ok(snap.assets >= base.assets, `asset count regressed: ${snap.assets} < ${base.assets}`);
    const dC = snap.classes - base.classes;
    const dA = snap.assets - base.assets;
    note = dC > 0 || dA > 0 ? `grew (+${dC} classes, +${dA} assets)` : 'no change';
  }
  writeFileSync(BASELINE_FILE, JSON.stringify({ classes: snap.classes, assets: snap.assets, recordedAt: new Date().toISOString() }, null, 2));
  logRow(new Date().toISOString(), snap.classes, snap.assets, snap.bridge, note);
});

// ── Tier 2: advance the garden against the live editor ────────────────────────────
test('growth: advance garden entities against the live UE editor', { skip: tier2Skip }, async (t) => {
  const status = (await mcp.call('pof_ue_status')).json;
  if (!isBridgeConnected(status)) {
    t.skip('PoF UE bridge offline — start the UE editor with the PoF bridge plugin (port 30040)');
    return;
  }
  const before = await snapshot();
  const drained: string[] = [];
  for (const catalogId of GARDEN) {
    const ents = (await mcp.call('pof_list_entities', { catalogId })).json as Array<{ id: string }>;
    if (!Array.isArray(ents) || !ents.length) continue;
    // Bridge executor (default): drain against the running editor on :30040.
    const res = await mcp.call('pof_drain_gates', { catalogId, entityId: ents[0].id });
    drained.push(`${catalogId}:${res.isError ? 'err' : (res.json?.ran ?? 0)}`);
  }
  const after = await snapshot();
  assert.ok(after.classes >= before.classes, `class count regressed during growth: ${after.classes} < ${before.classes}`);
  assert.ok(after.assets >= before.assets, `asset count regressed during growth: ${after.assets} < ${before.assets}`);
  logRow(new Date().toISOString(), after.classes, after.assets, after.bridge, `editor growth: drained ${drained.join(', ')}`);
});
