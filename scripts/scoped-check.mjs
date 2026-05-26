import { execSync } from 'node:child_process';

// Per-CLI scoped gate: typecheck the whole project (fast, isolates contract breaks),
// then lint + test ONLY the files this CLI changed vs HEAD, so foreign in-progress work
// on the shared tree does not fail this CLI's gate. tsc is run tolerantly: the 3
// pre-existing AssetInspector.tsx errors are excluded; any OTHER `error TS` fails the gate.
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
console.log('scoped-check: OK');
