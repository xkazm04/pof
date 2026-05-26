import { execSync } from 'node:child_process';

// Per-CLI scoped gate: typecheck (whole project — fast, isolates contract breaks),
// then lint + test ONLY the files this CLI changed vs origin/HEAD, so foreign
// in-progress work on the shared tree does not fail this CLI's gate.
const changed = execSync('git diff --name-only HEAD', { encoding: 'utf8' })
  .split('\n').map((s) => s.trim()).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
const src = changed.filter((f) => f.startsWith('src/') && !f.includes('__tests__'));
const tests = changed.filter((f) => f.includes('__tests__'));

const tsc = execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: 'pipe' }).toString();
// (tsc output is filtered for AssetInspector by the caller)
if (src.length) execSync(`npx eslint ${src.join(' ')}`, { stdio: 'inherit' });
if (tests.length) execSync(`npx vitest run ${tests.join(' ')}`, { stdio: 'inherit' });
console.log('scoped-check: OK');
