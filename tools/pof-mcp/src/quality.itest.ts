import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectMcp, backendReachable, ORIGIN, type McpHandle } from './harness.js';
import { MCP_WALKER_SKIP } from './coverage.js';

/**
 * Layer 2 — core quality. Drives PoF's API-backed core through the MCP and asserts the
 * OUTCOMES are sound (not just "200 OK"): every catalog step yields a well-formed recipe and
 * a non-failing example verdict; submit derives + discriminates; the simulators return sane
 * numbers; the design-truth signals satisfy their invariants. This is the "never truly
 * tested" surface. Skips cleanly when the backend is down.
 */
const UP = await backendReachable();
const skip = UP ? false : `PoF backend not reachable at ${ORIGIN} — start the dev server (npm run dev)`;
const VALID_STATUS = new Set(['pass', 'pending', 'fail', 'deferred']);
const CONFIG_COMPLETE = new Set(['pass', 'deferred']);
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

let mcp: McpHandle;
before(async () => {
  mcp = await connectMcp();
});
after(async () => {
  await mcp?.close();
});

// ── 2a. Pipeline recipe walk: every catalog × every step, read-only ──────────────
test('quality: every catalog step yields a well-formed recipe with a non-failing example', { skip }, async () => {
  const catalogs = (await mcp.call('pof_list_catalogs')).json as Array<{ catalogId: string; steps: string[]; entityCount: number; registered: boolean }>;
  assert.ok(Array.isArray(catalogs) && catalogs.length > 0, 'no catalogs returned');

  const issues: string[] = [];
  let stepsWalked = 0;

  for (const c of catalogs) {
    if (MCP_WALKER_SKIP[c.catalogId]) continue;
    if (!c.registered || c.entityCount === 0 || c.steps.length === 0) continue;

    const ents = (await mcp.call('pof_list_entities', { catalogId: c.catalogId })).json as Array<{ id: string }>;
    if (!Array.isArray(ents) || ents.length === 0) {
      issues.push(`${c.catalogId}: no entities to walk`);
      continue;
    }
    const entityId = ents[0].id;

    for (const step of c.steps) {
      const res = await mcp.call('pof_get_step', { catalogId: c.catalogId, entityId, step });
      const where = `${c.catalogId} · ${step}`;
      if (res.isError || !res.json) {
        issues.push(`${where}: get_step errored: ${res.text.slice(0, 120)}`);
        continue;
      }
      const r = res.json;
      stepsWalked++;
      if (typeof r.prompt !== 'string' || !r.prompt.includes(`Produce ${step} for`)) issues.push(`${where}: prompt missing the Produce instruction`);
      if (typeof r.archetype !== 'string' || !r.archetype) issues.push(`${where}: missing archetype`);
      if (!r.view || typeof r.view.kind !== 'string') issues.push(`${where}: missing view.kind`);
      if (!r.acceptance || !/^L[0-4]$/.test(r.acceptance.tier)) issues.push(`${where}: acceptance.tier invalid (${r.acceptance?.tier})`);
      if (r.acceptance && !VALID_STATUS.has(r.acceptance.currentStatus)) issues.push(`${where}: currentStatus invalid (${r.acceptance.currentStatus})`);
      // The produce default must never grade as a hard FAIL (Rule 4: a clean produce reaches config-complete).
      if (r.acceptance?.exampleStatus && !CONFIG_COMPLETE.has(r.acceptance.exampleStatus) && r.acceptance.exampleStatus === 'fail') {
        issues.push(`${where}: example data grades 'fail' (produce default should never fail)`);
      }
    }
  }

  assert.ok(stepsWalked > 50, `expected to walk many steps, only walked ${stepsWalked}`);
  assert.deepEqual(issues, [], `recipe-quality issues:\n  ${issues.join('\n  ')}`);
});

// ── 2b. Submit derives server-side + discriminates good vs bad ────────────────────
test('quality: submit derives a passing verdict for good data and a non-pass for bad data', { skip }, async () => {
  const recipe = (await mcp.call('pof_get_step', { catalogId: 'items', entityId: 'item-1', step: 'Concept Brief' })).json;
  assert.ok(recipe?.example?.data, 'no example data on the items Concept Brief recipe');

  const good = await mcp.call('pof_submit_artifact', {
    catalogId: 'items', entityId: 'test-mcp-quality', step: 'Concept Brief',
    data: recipe.example.data, ueAssets: recipe.example.ueAssetTargets ?? [],
  });
  assert.equal(good.isError, false, `good submit errored: ${good.text.slice(0, 200)}`);
  assert.ok(CONFIG_COMPLETE.has(good.json.acceptance.status), `good data should be config-complete, got ${good.json.acceptance.status}`);

  const bad = await mcp.call('pof_submit_artifact', {
    catalogId: 'items', entityId: 'test-mcp-quality', step: 'Concept Brief',
    data: { brief: 'too short' }, ueAssets: [],
  });
  assert.equal(bad.isError, false, `bad submit errored: ${bad.text.slice(0, 200)}`);
  assert.ok(!CONFIG_COMPLETE.has(bad.json.acceptance.status), `bad data should NOT pass, got ${bad.json.acceptance.status}`);
});

// ── 2c. Simulation quality ────────────────────────────────────────────────────────
test('quality: combat simulation returns sane numbers', { skip }, async () => {
  const cat = (await mcp.call('pof_combat_catalog')).json;
  assert.ok(cat?.enemies?.length && cat?.abilities?.length && cat?.gearLoadouts?.length, 'combat catalog incomplete');
  const enemy = cat.enemies[0];
  const scenario = {
    name: 'mcp-quality',
    playerLevel: 10,
    playerGear: cat.gearLoadouts[0],
    playerAbilities: cat.abilities.slice(0, 4),
    enemies: [{ archetypeId: enemy.archetypeId ?? enemy.id, count: 3, level: 10 }],
  };
  const res = await mcp.call('pof_combat_simulate', { scenario, config: { iterations: 40, seed: 12345, maxFightDurationSec: 60 } });
  assert.equal(res.isError, false, `combat sim errored: ${res.text.slice(0, 300)}`);
  const out = res.json.result ?? res.json; // route wraps the payload in { result }
  const sum = out.summary;
  assert.ok(out.fights?.length >= 1, 'no fights');
  assert.ok(isNum(sum.survivalRate) && sum.survivalRate >= 0 && sum.survivalRate <= 1, `survivalRate out of [0,1]: ${sum.survivalRate}`);
  assert.ok(Array.isArray(out.alerts), 'alerts not an array');
});

test('quality: economy simulation returns sane numbers', { skip }, async () => {
  const cat = (await mcp.call('pof_economy_catalog')).json;
  assert.ok(cat?.defaultConfig, 'economy catalog has no defaultConfig');
  const config = { ...cat.defaultConfig, seed: 12345 };
  const res = await mcp.call('pof_economy_simulate', { config });
  assert.equal(res.isError, false, `economy sim errored: ${res.text.slice(0, 300)}`);
  const metrics = res.json.metrics ?? res.json.result?.metrics ?? res.json.result?.levelMetrics;
  assert.ok(Array.isArray(metrics) && metrics.length > 0, 'no economy metrics returned');
  for (const m of metrics) {
    if (m.giniCoefficient != null) assert.ok(isNum(m.giniCoefficient) && m.giniCoefficient >= 0 && m.giniCoefficient <= 1, `gini out of [0,1]: ${m.giniCoefficient}`);
  }
});

// ── 2d. Design-truth invariants ─────────────────────────────────────────────────
test('quality: gdd compliance score is bounded [0,100]', { skip }, async () => {
  const r = (await mcp.call('pof_gdd_compliance')).json;
  assert.ok(isNum(r.overallScore) && r.overallScore >= 0 && r.overallScore <= 100, `overallScore out of [0,100]: ${r.overallScore}`);
  assert.ok(isNum(r.totalGaps) && r.totalGaps >= 0, `totalGaps not a non-negative number: ${r.totalGaps}`);
  assert.ok(isNum(r.criticalGaps) && r.criticalGaps >= 0 && r.criticalGaps <= r.totalGaps, `criticalGaps invalid vs totalGaps: ${r.criticalGaps}/${r.totalGaps}`);
});

test('quality: feature-matrix counts are internally consistent', { skip }, async () => {
  const all = (await mcp.call('pof_feature_matrix_all')).json;
  const statuses = all.statuses ?? all;
  for (const [moduleId, s] of Object.entries<any>(statuses)) {
    if (s && isNum(s.total)) {
      const parts = (s.implemented ?? 0) + (s.missing ?? 0) + (s.unknown ?? 0) + (s.inProgress ?? 0) + (s.partial ?? 0);
      assert.ok(parts <= s.total + 0.0001 || parts === s.total, `${moduleId}: status parts ${parts} exceed total ${s.total}`);
    }
  }
});

test('quality: project health scores are finite and bounded', { skip }, async () => {
  const h = (await mcp.call('pof_project_health')).json;
  for (const k of ['overallCompletion', 'currentQualityScore', 'performanceScore']) {
    if (h[k] != null) assert.ok(isNum(h[k]) && h[k] >= 0 && h[k] <= 100, `${k} out of [0,100]: ${h[k]}`);
  }
});
