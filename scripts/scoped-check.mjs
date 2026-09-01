import { execSync } from 'node:child_process';

// Per-CLI scoped gate: typecheck the whole project (fast, isolates contract breaks),
// then lint + test ONLY the files this CLI changed vs HEAD, so foreign in-progress work
// on the shared tree does not fail this CLI's gate. tsc is run tolerantly: the 3
// pre-existing AssetInspector.tsx errors are excluded; any OTHER `error TS` fails the gate.

// Regenerate the gitignored pipeline registry barrel so tsc/vitest never see a missing file.
execSync('node scripts/gen-pipeline-registry.mjs', { stdio: 'ignore' });

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    return `${e.stdout ?? ''}${e.stderr ?? ''}`; // capture output even on non-zero exit
  }
}

const tscOut = run('npx tsc --noEmit');
const tscErrors = tscOut.split('\n').filter((l) => /error TS/.test(l) && !l.includes('AssetInspector'));
if (tscErrors.length) {
  console.error(`scoped-check: ${tscErrors.length} TypeScript error(s):\n${tscErrors.join('\n')}`);
  process.exit(1);
}

const changed = run('git diff --name-only HEAD')
  .split('\n').map((s) => s.trim()).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
const src = changed.filter((f) => f.startsWith('src/') && !f.includes('__tests__'));
const tests = changed.filter((f) => f.includes('__tests__'));

try {
  if (src.length) execSync(`npx eslint ${src.join(' ')}`, { stdio: 'inherit' });
  if (tests.length) execSync(`npx vitest run ${tests.join(' ')}`, { stdio: 'inherit' });
} catch {
  console.error('scoped-check: lint or test failed');
  process.exit(1);
}

// Artifact-level cap on the shared fleet memory. CLAUDE.md caps each session's append
// at 2 lines AND the file at ~200 lines; only the first was ever visible per commit, and
// the file sat over cap for 13 days of compliant appends. The check reads the file, not
// the edit; a red here names the one-command remedy.
try {
  execSync('node scripts/fleet-memory-cap.mjs', { stdio: 'inherit' });
} catch {
  process.exit(1);
}
console.log('scoped-check: OK');
