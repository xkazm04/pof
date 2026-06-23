#!/usr/bin/env node
/**
 * Animation Reality Ledger CLI.
 *
 *   node scripts/animation-ledger.mjs --project "<UE project root>" [--out <file>] [--logs <dir>[,<dir>]]
 *
 * Prints a red/green console report and writes the full ledger JSON. Use it any
 * time to see whether generated animation code references real, valid assets.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildLedger } from '../src/lib/animation/reality-ledger.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const projectPath = arg('--project');
if (!projectPath) {
  console.error('Usage: node scripts/animation-ledger.mjs --project "<UE project root>" [--out <file>] [--logs <dir,dir>]');
  process.exit(2);
}
if (!fs.existsSync(path.join(projectPath, 'Content')) && !fs.existsSync(path.join(projectPath, 'Source'))) {
  console.error(`No Content/ or Source/ under "${projectPath}" — is that the UE project root?`);
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const logsArg = arg('--logs');
const logDirs = logsArg
  ? logsArg.split(',').map((d) => d.trim())
  : [path.join(projectPath, '.claude', 'logs'), repoRoot]; // repo root holds scn-*.log runtime traces

const ledger = buildLedger({ projectPath, logDirs });

const out = arg('--out', 'reality-ledger.json');
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, JSON.stringify(ledger, null, 2));

const s = ledger.summary;
const C = { red: '\x1b[31m', green: '\x1b[32m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' };
const badge = s.status === 'green' ? `${C.green}● GREEN${C.reset}` : `${C.red}● RED${C.reset}`;
console.log(`\n${C.bold}Animation Reality Ledger${C.reset}  ${badge}`);
console.log(`${C.dim}${projectPath}${C.reset}`);
console.log(`  source files: ${s.sourceFiles}   content assets: ${s.contentAssets}`);
console.log(`  referenced: ${s.referenced}  (exist ${s.existing} / missing ${s.missing})  empty-shells: ${s.emptyShells}  orphans: ${s.orphans}  runtime-fallbacks: ${s.runtimeFallbacks}`);

const list = (title, rows, fmt) => {
  if (!rows.length) return;
  console.log(`\n${C.bold}${title} (${rows.length})${C.reset}`);
  rows.forEach((r) => console.log('  ' + fmt(r)));
};
list('MISSING — referenced but not on disk', ledger.missing, (r) => `${r.kind.padEnd(13)} ${r.path}  ${C.dim}<- ${r.referencedBy.slice(0, 3).join(', ')}${C.reset}`);
list('EMPTY SHELLS — referenced montage, suspiciously small', ledger.emptyShells, (r) => `${String(r.sizeBytes).padStart(7)}B  ${r.path}  ${C.dim}<- ${r.referencedBy.slice(0, 3).join(', ')}${C.reset}`);
list('ORPHANS — montage/sequence on disk, referenced by nothing', ledger.orphans, (r) => `${String(r.sizeBytes).padStart(7)}B  ${r.path}`);
list('RUNTIME FALLBACKS', ledger.runtimeFallbacks, (r) => `${r.signal}  ${C.dim}(${r.source})${C.reset}`);

console.log(`\nwrote ${out}`);
process.exit(s.status === 'green' ? 0 : 1);
