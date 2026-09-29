// Artifact-level cap for .claude/fleet-memory.md.
//
// CLAUDE.md states two rules for this file: each session appends AT MOST 2 lines
// (a per-edit cap), and the file stays under ~200 lines, pruning the oldest
// DELIVERED lines when it grows past that (an artifact cap). The per-edit cap was
// obeyed by every one of the last 24 commits; the artifact cap was crossed on
// 2026-08-19 and nothing noticed, because no check ever read the file's length —
// every edit was compliant, and the sum of compliant edits was not. This script is
// the check that reads the artifact.
//
//   node scripts/fleet-memory-cap.mjs          # exit 1 when over the cap, with the remedy
//   node scripts/fleet-memory-cap.mjs --prune  # apply the stated remedy: drop oldest DELIVERED lines
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

const FILE = '.claude/fleet-memory.md';
const CAP = 200;
const ENTRY = /^- \[\d{4}-\d{2}-\d{2}\] \[[^\]]+\] (DECISION|DELIVERED|CONVENTION):/;

const lineCount = (text) => { const n = text.split('\n').length; return text.endsWith('\n') ? n - 1 : n; };

// Sessions append to this file while it is pruned, so the prune is a read-modify-write over a
// shared file. A plain read-then-write drops a line appended in between. Instead: write the pruned
// text to a temp file, then confirm the file still holds the text it was computed from; if not,
// throw the temp away and prune the fresh text. The rename is atomic, so a reader never sees a
// torn file. What remains is the instant between the confirm and the rename; only a lock closes it.
function prune() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const text = readFileSync(FILE, 'utf8');
    const count = lineCount(text);
    let over = count - CAP;
    const kept = [];
    for (const line of text.split('\n')) {
      if (over > 0 && ENTRY.test(line) && line.includes('] DELIVERED:')) { over--; continue; }
      kept.push(line);
    }
    const tmp = `${FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, kept.join('\n'));
    if (readFileSync(FILE, 'utf8') === text) {
      renameSync(tmp, FILE);
      return { count, now: kept.length - (text.endsWith('\n') ? 1 : 0) };
    }
    rmSync(tmp);
  }
  console.error(`fleet-memory-cap: ${FILE} kept changing under the prune (5 attempts); nothing written. Re-run.`);
  process.exit(2);
}

if (process.argv.includes('--prune')) {
  const { count, now } = prune();
  console.log(`fleet-memory-cap: pruned ${count - now} oldest DELIVERED line(s); ${now}/${CAP}`);
  process.exit(now > CAP ? 1 : 0);
}

const count = lineCount(readFileSync(FILE, 'utf8'));

if (count > CAP) {
  console.error(`fleet-memory-cap: ${FILE} is ${count} lines, cap ${CAP} (+${count - CAP}). ` +
    `Remedy per CLAUDE.md: node scripts/fleet-memory-cap.mjs --prune`);
  process.exit(1);
}
console.log(`fleet-memory-cap: ${count}/${CAP} lines`);
