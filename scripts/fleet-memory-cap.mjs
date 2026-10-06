/* eslint-disable no-console -- CLI harness; stdout is its interface. */
// Artifact-level cap for .claude/fleet-memory.md.
//
// CLAUDE.md states two rules for this file: each session appends AT MOST 2 lines
// (a per-edit cap), and the file holds at most 200 ENTRY lines (an artifact cap). The
// per-edit cap was obeyed by every one of the last 24 commits; the artifact cap was crossed
// on 2026-08-19 and nothing noticed, because no check ever read the file's size — every edit
// was compliant, and the sum of compliant edits was not. This script is the check that reads
// the artifact.
//
// The cap counts entry lines (`- [date] [area] KIND: ...`), not file lines: the header is
// documentation, not memory. Counting file lines made the cap unreachable once DECISION and
// CONVENTION lines alone outgrew it, and those are never deleted.
//
//   node scripts/fleet-memory-cap.mjs          # exit 1 when over the cap, with the remedy
//   node scripts/fleet-memory-cap.mjs --prune  # move the oldest DELIVERED entries, verbatim, to
//                                              # .claude/fleet-memory-archive.md until <= cap
//
// The planning is the pure planFleetMemoryPrune in src/lib/fleet-memory-cap.ts (Node strips its
// types, same as kpi-scan-sweep-debt.mjs); this file is only the I/O shell around it.
import { appendFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

// The pure module is a .ts file in a package without "type": "module", so Node prints a
// MODULE_TYPELESS_PACKAGE_JSON reparse warning on load. scoped-check.mjs and `npm run check:fleet-memory`
// invoke this without --no-warnings, so drop that one default warning printer before importing.
process.removeAllListeners('warning');
const { countFleetMemoryEntries, planFleetMemoryPrune } = await import('../src/lib/fleet-memory-cap.ts');

const FILE = '.claude/fleet-memory.md';
const ARCHIVE = '.claude/fleet-memory-archive.md';
const CAP = 200;

const ARCHIVE_HEADER = [
  '# Fleet Shared Memory — Archive',
  '',
  `Append-only. DELIVERED lines moved here verbatim from ${FILE} by \`node scripts/fleet-memory-cap.mjs --prune\``,
  `when the live file passed its cap of ${CAP} entries, oldest first. Nothing is rewritten or deleted here; DECISION`,
  'and CONVENTION lines are never archived and stay in the live file. Read this only to look up when something shipped.',
  '',
  '## Entries',
  '',
];

// Sessions append to the live file while it is pruned, so the prune is a read-modify-write over a
// shared file. A plain read-then-write drops a line appended in between. Instead: write the pruned
// text to a temp file, then confirm the file still holds the text it was computed from; if not,
// throw the temp away and plan again from the fresh text. The rename is atomic, so a reader never
// sees a torn file. What remains is the instant between the confirm and the rename; only a lock
// closes it. The archive is appended only after the rename succeeds, so a failed prune never
// leaves a line in both files.
function prune() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const text = readFileSync(FILE, 'utf8');
    const plan = planFleetMemoryPrune(text, CAP);
    if (!plan.ok) return plan;
    if (plan.archived.length === 0) return plan;
    const tmp = `${FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, plan.kept);
    if (readFileSync(FILE, 'utf8') === text) {
      renameSync(tmp, FILE);
      const eol = text.includes('\r\n') ? '\r\n' : '\n';
      const head = existsSync(ARCHIVE) ? '' : ARCHIVE_HEADER.join(eol) + eol;
      appendFileSync(ARCHIVE, head + plan.archived.map((l) => l.replace(/\r$/, '') + eol).join(''));
      return plan;
    }
    rmSync(tmp);
  }
  console.error(`fleet-memory-cap: ${FILE} kept changing under the prune (5 attempts); nothing written. Re-run.`);
  process.exit(2);
}

if (process.argv.includes('--prune')) {
  const plan = prune();
  if (!plan.ok) {
    console.error(`fleet-memory-cap: ${plan.message} Nothing was written.`);
    process.exit(1);
  }
  console.log(`fleet-memory-cap: archived ${plan.archived.length} oldest DELIVERED entr${plan.archived.length === 1 ? 'y' : 'ies'} to ${ARCHIVE}; ${plan.entriesAfter}/${CAP} entries`);
  process.exit(0);
}

const entries = countFleetMemoryEntries(readFileSync(FILE, 'utf8'));

if (entries > CAP) {
  console.error(`fleet-memory-cap: ${FILE} holds ${entries} entries, cap ${CAP} (+${entries - CAP}). ` +
    `Remedy per CLAUDE.md: node scripts/fleet-memory-cap.mjs --prune`);
  process.exit(1);
}
console.log(`fleet-memory-cap: ${entries}/${CAP} entries`);
