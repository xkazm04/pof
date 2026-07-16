#!/usr/bin/env node
// CLI harness: all progress + the summary table go to STDERR via console.error (lint-allowed),
// keeping stdout clean; the durable output is the JSON file it writes.
/**
 * Headless-coverage walker for the /status quality gate.
 *
 * Proves, per (catalogId, step), that the step is OPERABLE HEADLESS through the
 * `pof-mcp` MCP server — i.e. a human-free agent can address and drive it with no
 * `/layout` UI. Two round-trips per step, both over the real stdio MCP transport:
 *
 *   (a) pof_get_step for a REAL seeded entity  → the step is individually addressable
 *       (the server returns its recipe: prompt + acceptance contract).
 *   (b) pof_submit_artifact for the SYNTHETIC entity `test-headless-mcp` with minimal
 *       recipe-shaped data → the server DERIVES a verdict (any of pass/pending/deferred/
 *       fail proves the submit round-trip works). A transport/tool error means the step
 *       is NOT operable headless.
 *
 * `test-headless-mcp` is excluded from the /status map by isSyntheticEntity() in
 * src/lib/status/statusModel.ts (it `startsWith('test-headless')`), so these probe
 * submits never poison a real content cell.
 *
 * We reuse tools/pof-mcp's own integration-test harness (connectMcp) — the same way its
 * contract.itest.ts drives the server — so the SDK resolves from pof-mcp's node_modules
 * and this script proves the exact transport the CLI uses.
 *
 * Output: src/lib/status/headless-coverage.json (deterministic: steps sorted by
 * catalogId then step) — the pure gate in statusModel.ts imports it like step-facts.json.
 *
 * Usage:  POF_APP_ORIGIN=http://localhost:3001 node scripts/headless-coverage.mjs
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectMcp, backendReachable, ORIGIN } from '../tools/pof-mcp/dist/harness.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'lib', 'status', 'headless-coverage.json');
const SYNTHETIC_ENTITY = 'test-headless-mcp';

/** Minimal recipe-shaped submit body: prefer the recipe's own passing example, else a probe. */
function submitData(recipe) {
  const ex = recipe && recipe.example && recipe.example.data;
  if (ex && typeof ex === 'object' && !Array.isArray(ex)) return ex;
  return { __headlessProbe: true };
}

/** Read a derived verdict out of the submit response ({ artifact, acceptance }). */
function derivedStatus(json) {
  if (!json || typeof json !== 'object') return undefined;
  return json.acceptance?.status ?? json.artifact?.status;
}

function firstLine(text) {
  return String(text || '').split('\n')[0].trim().slice(0, 300);
}

async function main() {
  if (!(await backendReachable())) {
    console.error(`[headless-coverage] PoF backend NOT reachable at ${ORIGIN}. Start it (npm run dev) and retry.`);
    process.exit(1);
  }
  console.error(`[headless-coverage] backend up at ${ORIGIN} — spawning pof-mcp over stdio…`);
  const mcp = await connectMcp();

  const results = [];
  try {
    const catRes = await mcp.call('pof_list_catalogs', {});
    if (catRes.isError || !Array.isArray(catRes.json)) {
      throw new Error(`pof_list_catalogs failed: ${firstLine(catRes.text)}`);
    }
    const catalogs = catRes.json;

    for (const cat of catalogs) {
      const catalogId = cat.catalogId;
      const steps = Array.isArray(cat.steps) ? cat.steps : [];
      if (steps.length === 0) {
        console.error(`  · ${catalogId}: 0 steps — nothing to walk, skipping`);
        continue;
      }

      // Resolve a real seeded entity for the addressability probe (get_step).
      const entRes = await mcp.call('pof_list_entities', { catalogId });
      const entities = Array.isArray(entRes.json) ? entRes.json : [];
      const realEntity = entities.length > 0 ? entities[0].id : undefined;
      const noEntityReason = entRes.isError
        ? `pof_list_entities failed: ${firstLine(entRes.text)}`
        : 'no seeded entity for this catalog (absent from CATALOG_SECTIONS / seed) — cannot address any step headless';

      for (const step of steps) {
        if (!realEntity) {
          results.push({ catalogId, step, operable: false, reason: noEntityReason });
          continue;
        }

        // (a) addressability — pof_get_step for the real entity.
        const recipeRes = await mcp.call('pof_get_step', { catalogId, entityId: realEntity, step });
        if (recipeRes.isError || !recipeRes.json || typeof recipeRes.json !== 'object') {
          results.push({ catalogId, step, operable: false, reason: `pof_get_step: ${firstLine(recipeRes.text)}` });
          continue;
        }

        // (b) submit round-trip — pof_submit_artifact for the synthetic entity.
        const submitRes = await mcp.call('pof_submit_artifact', {
          catalogId,
          entityId: SYNTHETIC_ENTITY,
          step,
          data: submitData(recipeRes.json),
          ueAssets: [],
        });
        const verdict = derivedStatus(submitRes.json);
        if (submitRes.isError || !verdict) {
          results.push({ catalogId, step, operable: false, reason: `pof_submit_artifact: ${firstLine(submitRes.text) || 'no derived verdict returned'}` });
          continue;
        }

        results.push({ catalogId, step, operable: true });
      }
      const opN = results.filter((r) => r.catalogId === catalogId && r.operable).length;
      console.error(`  · ${catalogId}: ${opN}/${steps.length} operable`);
    }
  } finally {
    await mcp.close();
  }

  // Deterministic ordering so diffs are stable.
  results.sort((a, b) => a.catalogId.localeCompare(b.catalogId) || a.step.localeCompare(b.step));

  const payload = {
    generatedAt: new Date().toISOString(),
    origin: ORIGIN,
    via: 'pof-mcp',
    steps: results,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');

  const operable = results.filter((r) => r.operable).length;
  const notOperable = results.length - operable;
  console.error(`\n[headless-coverage] wrote ${OUT}`);
  console.error(`[headless-coverage] ${operable} operable / ${notOperable} not (${results.length} steps across ${new Set(results.map((r) => r.catalogId)).size} catalogs)`);
  if (notOperable > 0) {
    console.error('[headless-coverage] NOT operable:');
    for (const r of results.filter((x) => !x.operable)) console.error(`    ${r.catalogId} :: ${r.step} — ${r.reason}`);
  }
}

main().catch((e) => {
  console.error('[headless-coverage] FATAL:', e instanceof Error ? e.stack : e);
  process.exit(1);
});
