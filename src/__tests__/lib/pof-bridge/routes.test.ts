/**
 * One declared PoF route table.
 *
 * The PoF plugin's HTTP routes used to live in four hand-maintained copies that
 * already disagreed (the Bridge Endpoints monitor, PofBridgeClient, the
 * /api/pof-bridge proxy handlers, run-python.ts). `POF_ROUTES` is now the single
 * declaration and `planRouteProbe` decides — purely, from the declaration — how
 * (and whether) a health check may touch a route.
 *
 * Pinned here (acceptance cases 2, 5, 7 of ue5-bridge-monitoring/A):
 *   2. '/pof/manifest' is probed through its cheap checksum-only form;
 *   5. the monitor's rows are exactly the declared routes, python/run included;
 *   7. drift guard: every route the app calls is a declared route.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { POF_ROUTES, planRouteProbe } from '@/lib/pof-bridge/routes';
import { SUBSYSTEMS } from '@/components/modules/project-setup/BridgeEndpointHealth/constants';

const ROOT = resolve(__dirname, '../../../..');
const DECLARED = new Set(POF_ROUTES.map((r) => r.path));

function routeOf(path: string) {
  const r = POF_ROUTES.find((x) => x.path === path);
  if (!r) throw new Error(`route ${path} is not declared`);
  return r;
}

/** '/pof/x/${id}?q=1' -> '/pof/x' : query and interpolated segments dropped. */
function normalise(raw: string): string {
  const at = raw.indexOf('/pof/');
  let p = at >= 0 ? raw.slice(at) : raw;
  p = p.replace(/\$\{[^}]*\}/g, '').split('?')[0];
  p = p.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return p;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Every string literal (', ", `) in `src` that contains '/pof/'. */
function pofLiterals(src: string): string[] {
  const out: string[] = [];
  const re = /(['"`])([^'"`\n]*\/pof\/[^'"`\n]*)\1/g;
  for (const m of stripComments(src).matchAll(re)) out.push(normalise(m[2]));
  return out;
}

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (name === 'route.ts') out.push(full);
  }
  return out;
}

/** String literals inside the FIRST argument of every proxyToPofBridge(...) call. */
function proxyFirstArgs(src: string): string[] {
  const out: string[] = [];
  const call = /proxyToPofBridge(?:<[^(]*?>)?\(\s*([^,]*?),/g;
  for (const m of src.matchAll(call)) {
    for (const lit of m[1].matchAll(/(['"`])((?:(?!\1)[^\n])*)\1/g)) {
      out.push(normalise(`/pof/${lit[2]}`));
    }
  }
  return out;
}

describe('case 2 — the manifest is probed through its cheap form', () => {
  it("planRouteProbe('/pof/manifest') -> http-get '/pof/manifest?checksum-only=true'", () => {
    expect(planRouteProbe(routeOf('/pof/manifest'))).toEqual({
      kind: 'http-get',
      path: '/pof/manifest?checksum-only=true',
    });
  });
});

describe('case 5 — the monitor lists exactly the declared routes', () => {
  it('flattened SUBSYSTEMS paths === POF_ROUTES paths, python/run included', () => {
    const monitored = SUBSYSTEMS.flatMap((s) => s.endpoints.map((e) => e.path));
    expect(new Set(monitored)).toEqual(DECLARED);
    expect(monitored).toHaveLength(POF_ROUTES.length);
    expect(DECLARED.has('/pof/python/run')).toBe(true);
  });
});

describe('case 7 — drift guard: every route the app calls is declared', () => {
  it('client.ts and run-python.ts route literals are declared', () => {
    const client = pofLiterals(readFileSync(join(ROOT, 'src/lib/pof-bridge/client.ts'), 'utf8'));
    const python = pofLiterals(readFileSync(join(ROOT, 'src/lib/bridge/run-python.ts'), 'utf8'));
    // Non-vacuous: the census found the literals it is guarding.
    expect(client.length).toBeGreaterThanOrEqual(11);
    expect(python).toContain('/pof/python/run');
    expect([...client, ...python].filter((p) => !DECLARED.has(p))).toEqual([]);
  });

  it('every proxyToPofBridge(...) first argument in /api/pof-bridge is declared', () => {
    const files = routeFiles(join(ROOT, 'src/app/api/pof-bridge'));
    const used = files.flatMap((f) => proxyFirstArgs(readFileSync(f, 'utf8')));
    expect(used.length).toBeGreaterThanOrEqual(14);
    expect(used.filter((p) => !DECLARED.has(p))).toEqual([]);
  });
});
