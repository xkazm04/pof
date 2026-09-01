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
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = '.claude/fleet-memory.md';
const CAP = 200;
const ENTRY = /^- \[\d{4}-\d{2}-\d{2}\] \[[^\]]+\] (DECISION|DELIVERED|CONVENTION):/;

const text = readFileSync(FILE, 'utf8');
const lines = text.split('\n');
const count = text.endsWith('\n') ? lines.length - 1 : lines.length;

if (process.argv.includes('--prune')) {
  let over = count - CAP;
  const kept = [];
  for (const line of lines) {
    if (over > 0 && ENTRY.test(line) && line.includes('] DELIVERED:')) { over--; continue; }
    kept.push(line);
  }
  writeFileSync(FILE, kept.join('\n'));
  const now = kept.length - (text.endsWith('\n') ? 1 : 0);
  console.log(`fleet-memory-cap: pruned ${count - now} oldest DELIVERED line(s); ${now}/${CAP}`);
  process.exit(now > CAP ? 1 : 0);
}

if (count > CAP) {
  console.error(`fleet-memory-cap: ${FILE} is ${count} lines, cap ${CAP} (+${count - CAP}). ` +
    `Remedy per CLAUDE.md: node scripts/fleet-memory-cap.mjs --prune`);
  process.exit(1);
}
console.log(`fleet-memory-cap: ${count}/${CAP} lines`);
