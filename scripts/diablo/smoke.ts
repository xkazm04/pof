/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Load-order smoke: every src/lib/catalog/reference module must load when it is the FIRST module a process imports.
 * The canon profile, source registry and seeding modules form import cycles; a module-level read of a binding still in
 * its temporal dead zone crashes only the importer that enters the cycle at the wrong point (the descent CLI broke this
 * way in W40). vitest's loader resolves these cycles differently and cannot see it — so each module is imported in a
 * fresh child of THIS process's loader (run via `npx tsx`).
 *
 *   npx tsx scripts/diablo/smoke.ts
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = resolve(__dirname, '..', '..', 'src', 'lib', 'catalog', 'reference');
const modules = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts'));
const failures: string[] = [];
for (const name of modules) {
  const url = pathToFileURL(join(dir, name)).href;
  const run = spawnSync(process.execPath, [...process.execArgv, '-e', `import(${JSON.stringify(url)}).catch((e) => { console.error(e.message); process.exit(1); })`], { encoding: 'utf8' });
  if (run.status !== 0) failures.push(`${name}: ${(run.stderr || run.stdout).trim().split('\n').find((line) => /Error/.test(line)) ?? `exit ${run.status}`}`);
}
console.log(`load-order smoke: ${modules.length - failures.length}/${modules.length} reference modules load first`);
for (const failure of failures) console.log(`  FAIL ${failure}`);
process.exit(failures.length ? 1 : 0);
