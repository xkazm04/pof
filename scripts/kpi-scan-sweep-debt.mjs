/* eslint-disable no-console -- CLI harness; stdout is its interface. */
// Goal-2 KPI reading: the scan-sweep finding backlog per ISO week.
//
//   npm run kpi:sweep                      # one JSON reading on stdout
//   npm run kpi:sweep -- --file <path>     # read another ledger (default: the repo's own)
//
// READ-ONLY: only reads the JSONL ledger, never writes it or anything else. Node strips the
// types of the pure function file directly (same as kpi-matrix-freshness.mjs).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSweepDebt, parseScanSweepLedger } from '../src/lib/evaluator/scan-sweep-debt.ts';

const fi = process.argv.indexOf('--file');
const file = fi > -1
  ? resolve(process.argv[fi + 1] ?? '')
  : join(dirname(fileURLToPath(import.meta.url)), '..', '.claude', 'scan-history', 'scan-sweep.jsonl');

if (!existsSync(file)) {
  console.log(`no ledger at ${file}`);
  process.exit(0);
}

const now = Date.now();
const reading = scanSweepDebt(parseScanSweepLedger(readFileSync(file, 'utf8')), now);
console.log(JSON.stringify({
  kpi: 'scan-sweep-debt',
  readAt: new Date(now).toISOString(),
  file,
  ...reading,
}, null, 2));
