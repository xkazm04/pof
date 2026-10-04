#!/usr/bin/env node
/**
 * orrery-contract — hold the Orrery port to the contest winner's computed styles.
 *
 * A thin runner around the promotion instrument:
 *
 *   python .claude/skills/contest/scripts/style-contract.py check <url> \
 *     .contest/staging/storymap/roles.json <contract> --width 1600x900
 *
 * It runs the harness in BOTH themes and prints the instrument's table for each.
 * Nothing here widens a tolerance; it adapts shapes the instrument does not read
 * on its own, and it classifies what comes back. Three adaptations, each of which
 * is a real property of the captured contract:
 *
 *  1. SHAPE. `contract.merged.json` is a merge of several capture passes, so its
 *     roles are nested under a `roles` key beside `_note` / `_provenance` /
 *     `_missing` / `_missingNote`. The instrument iterates the contract's top
 *     level as roles, so handed the merged file raw it reports six pseudo-roles
 *     as MISSING and checks none of the real ones. The runner writes a FLAT
 *     contract (the `roles` block, verbatim) to a temp file and passes that.
 *
 *  2. UI STATE. `_provenance` records which state each role was measured in:
 *     20 at load, `crumb` and `tag` with a node selected, `chipw` drilled into a
 *     line, `auditGroup` / `auditCount` on the audit tab. A role measured in a
 *     state cannot be found at load, so the runner runs ONE PASS PER STATE with
 *     only that state's roles, driving the port into the state first (the
 *     instrument's own `--drive`). `--only load` restricts to the load pass.
 *     The drive steps are written against the `data-role` hooks in roles.json
 *     and are PROVISIONAL until the React packages implement the interactions —
 *     the runner says so in its output rather than pretending they ran.
 *
 *  3. WHAT A DEVIATION MEANS PER THEME. Theme 1 (`orrery`) is a 1:1 port, so any
 *     deviation is a defect. Theme 2 (`blueprint`) is a deliberate re-theme, so
 *     a different `color` / `backgroundColor` / `borderLeftColor` is the POINT;
 *     what must be zero is STRUCTURAL drift — type size and weight, line-height,
 *     tracking, case, family, border widths, radii, padding, rendered width, and
 *     the presence of a gradient or a shadow. The runner splits the instrument's
 *     rows on exactly that line and gates blueprint on the structural half.
 *     Both halves are always printed.
 *
 *   node scripts/orrery-contract.mjs [--url <base>] [--width 1600x900]
 *                                    [--theme orrery|blueprint] [--only <pass>]
 *                                    [--python <exe>] [--raw]
 *
 * Exits non-zero when the port drifts. `--raw` additionally prints the exact
 * command each pass ran, for reproducing one by hand.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SKILL = path.join(ROOT, '.claude', 'skills', 'contest', 'scripts', 'style-contract.py');
const ROLES = path.resolve(ROOT, 'scripts/orrery-contract/roles.json');
const CONTRACT = path.resolve(ROOT, 'scripts/orrery-contract/contract.json');

/** Properties whose whole purpose is to differ between themes. */
const COLOUR_PROPS = new Set(['color', 'backgroundColor', 'borderLeftColor']);

/**
 * How to drive the port into each state `_provenance` names. PROVISIONAL: the
 * React surface does not implement these interactions yet, so a pass other than
 * `load` cannot be trusted until it does. Selectors are the port-side hooks from
 * roles.json, so they stay correct as the surface is built.
 */
const DRIVES = {
  load: [],
  selected: ['click:[data-role=orrery-rel]', 'wait:400'],
  drilled: ['click:[data-role=orrery-rel]', 'wait:300', 'click:[data-role=orrery-script-row]', 'wait:400'],
  audit: ['click:[data-role=orrery-tab-idle]', 'wait:400'],
};

function parseArgs(argv) {
  const o = {
    url: 'http://localhost:3001/orrery-harness',
    width: '1600x900',
    themes: ['orrery', 'blueprint'],
    only: null,
    python: process.env.PYTHON || 'python',
    raw: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--url') o.url = argv[++i];
    else if (a === '--width') o.width = argv[++i];
    else if (a === '--theme') o.themes = [argv[++i]];
    else if (a === '--only') o.only = argv[++i];
    else if (a === '--python') o.python = argv[++i];
    else if (a === '--raw') o.raw = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return o;
}

/**
 * Group the contract's roles by the UI state they were measured in.
 *
 * The contract is the instrument's NATIVE shape: a FLAT role dict, exactly as `capture` writes one.
 * An earlier revision nested it under `roles` beside metadata keys, which made the instrument
 * iterate the metadata as roles and silently check none of the real ones. Provenance now lives in
 * the sibling `contract.merged.meta.json`; this reads it from there, and still tolerates the old
 * embedded form so a stale artifact degrades loudly rather than wrongly.
 */
function passes(merged, roles, meta) {
  const prov = meta?.provenance ?? merged._provenance ?? {};
  const roleDict = merged.roles ?? merged;
  const byPass = new Map();
  for (const role of Object.keys(roleDict)) {
    if (role.startsWith('_')) continue; // metadata, never a role
    if (!roles[role]) continue; // roles.json dropped it; nothing to check against
    const state = prov[role] ?? 'load';
    if (!byPass.has(state)) byPass.set(state, []);
    byPass.get(state).push(role);
  }
  // `load` first, then the driven states in a stable order.
  return [...byPass.entries()].sort(([a], [b]) => (a === 'load' ? -1 : b === 'load' ? 1 : a.localeCompare(b)));
}

/** Split the instrument's stdout into the rows it printed. */
function parseOutput(stdout) {
  const rows = [];
  const missing = [];
  const accepted = [];
  let summary = '';
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    let m = line.match(/^\s*MISSING\s+(\S+):/);
    if (m) { missing.push(m[1]); continue; }
    m = line.match(/^\s*accepted by the owner\s+(\S+?)\.(\S+?):\s*(.*)$/);
    if (m) { accepted.push({ role: m[1], prop: m[2], detail: m[3] }); continue; }
    if (/^\d+ deviation\(s\)/.test(line.trim())) { summary = line.trim(); continue; }
    if (/^role\s+property\s+winner\s+port$/.test(line.trim())) continue;
    m = line.match(/^(\S+)\s+(\S+)\s{2,}(.*)$/);
    if (m && !line.startsWith(' ')) { rows.push({ role: m[1], prop: m[2], detail: m[3].trim() }); continue; }
  }
  return { rows, missing, accepted, summary };
}

function run(opts, theme, passName, roleNames, flatContract, flatRoles) {
  const url = `${opts.url}${opts.url.includes('?') ? '&' : '?'}theme=${theme}`;
  const args = [SKILL, 'check', url, flatRoles, flatContract, '--width', opts.width];
  for (const step of DRIVES[passName] ?? []) args.push('--drive', step);

  if (opts.raw) {
    process.stdout.write(`\n$ ${opts.python} ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}\n`);
  }
  const r = spawnSync(opts.python, args, { encoding: 'utf-8', cwd: ROOT });
  if (r.error) {
    process.stdout.write(`  could not run the instrument: ${r.error.message}\n`);
    return { fatal: true };
  }
  const stdout = r.stdout ?? '';
  process.stdout.write(stdout.replace(/^/gm, '  ').replace(/\s*$/, '\n'));
  if (r.stderr && r.stderr.trim()) process.stdout.write(`  stderr: ${r.stderr.trim().split(/\r?\n/).slice(-3).join(' | ')}\n`);
  const parsed = parseOutput(stdout);
  // A pass whose drive could not run measured NOTHING. Reporting that as zero
  // deviations is how a check passes vacuously, so it is counted as UNKNOWN and
  // gates like a failure until the interaction exists.
  const ran = !!parsed.summary;
  if (!ran) {
    process.stdout.write(
      '  UNKNOWN: this pass could not be measured (the drive did not complete), so it proves nothing.\n',
    );
  }
  return { ...parsed, roleNames, exit: r.status, ran, fatal: false };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(fs.readFileSync(new URL(import.meta.url), 'utf-8').split('*/')[0] + '*/\n');
    return 0;
  }
  for (const f of [SKILL, ROLES, CONTRACT]) {
    if (!fs.existsSync(f)) {
      process.stderr.write(`missing input: ${f}\n`);
      return 2;
    }
  }

  const merged = JSON.parse(fs.readFileSync(CONTRACT, 'utf-8'));
  const roles = JSON.parse(fs.readFileSync(ROLES, 'utf-8')).roles;
  // Provenance (which UI state each role was captured in) lives beside the contract, so the
  // contract itself stays the flat shape the instrument reads.
  const METurl = CONTRACT.replace(/[.]json$/, '.meta.json');
  const meta = fs.existsSync(METurl) ? JSON.parse(fs.readFileSync(METurl, 'utf-8')) : null;
  const captured = merged.roles ?? Object.fromEntries(Object.entries(merged).filter(([k]) => !k.startsWith('_')));
  const staticOnly = meta?.missing ?? merged._missing ?? [];

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orrery-contract-'));
  const allPasses = passes(merged, roles, meta).filter(([name]) => !opts.only || name === opts.only);

  process.stdout.write(
    `\nOrrery style contract\n` +
      `  winner contract  ${path.relative(ROOT, CONTRACT)} (captured ${merged._capturedAt} at ${merged._width})\n` +
      `  roles            ${Object.keys(roles).length} mapped, ${Object.keys(captured).length} captured, ` +
      `${(merged._missing ?? []).length} static-CSS only (${(merged._missing ?? []).join(', ')})\n` +
      `  harness          ${opts.url}\n` +
      `  viewport         ${opts.width}\n`,
  );
  if (staticOnly.length) {
    process.stdout.write(
      `  NOTE             the static-CSS roles are NOT checked by the instrument; their values\n` +
        `                   are quoted in the contract's _missingNote and ported by hand.\n`,
    );
  }

  const verdicts = [];
  for (const theme of opts.themes) {
    process.stdout.write(`\n${'='.repeat(78)}\n== theme: ${theme}\n${'='.repeat(78)}\n`);
    const perTheme = { structural: [], colour: [], missing: [], accepted: [], unknown: [], fatal: false };

    for (const [passName, roleNames] of allPasses) {
      const flatContract = path.join(tmp, `contract.${passName}.json`);
      const flatRoles = path.join(tmp, `roles.${passName}.json`);
      // The flattening: the `roles` block, verbatim, nothing added or relaxed.
      fs.writeFileSync(
        flatContract,
        JSON.stringify(Object.fromEntries(roleNames.map((r) => [r, captured[r]])), null, 2),
      );
      fs.writeFileSync(
        flatRoles,
        JSON.stringify({ roles: Object.fromEntries(roleNames.map((r) => [r, roles[r]])) }, null, 2),
      );

      const steps = DRIVES[passName] ?? [];
      process.stdout.write(
        `\n-- pass "${passName}" (${roleNames.length} role${roleNames.length === 1 ? '' : 's'}: ${roleNames.join(', ')})\n`,
      );
      if (steps.length) {
        process.stdout.write(`   drive: ${steps.join(' -> ')}\n`);
        process.stdout.write(`   PROVISIONAL: these interactions are not implemented in the port yet.\n`);
      }
      const out = run(opts, theme, passName, roleNames, flatContract, flatRoles);
      if (out.fatal) { perTheme.fatal = true; continue; }
      if (!out.ran) { perTheme.unknown.push({ pass: passName, roles: roleNames }); continue; }
      for (const row of out.rows) {
        (COLOUR_PROPS.has(row.prop) ? perTheme.colour : perTheme.structural).push({ ...row, pass: passName });
      }
      perTheme.missing.push(...out.missing.map((r) => ({ role: r, pass: passName })));
      perTheme.accepted.push(...out.accepted.map((a) => ({ ...a, pass: passName })));
    }

    const faithful = theme !== 'blueprint';
    const unknownRoles = perTheme.unknown.reduce((n, u) => n + u.roles.length, 0);
    const gated =
      (faithful
        ? perTheme.structural.length + perTheme.colour.length + perTheme.missing.length
        : perTheme.structural.length + perTheme.missing.length) + unknownRoles;

    process.stdout.write(`\n-- verdict: ${theme}\n`);
    process.stdout.write(`   structural deviations  ${perTheme.structural.length}\n`);
    process.stdout.write(
      `   colour deviations      ${perTheme.colour.length}` +
        (faithful ? '   (a defect in a 1:1 port)\n' : '   (expected: this theme re-hues on purpose)\n'),
    );
    process.stdout.write(`   roles not rendered     ${perTheme.missing.length}`);
    process.stdout.write(perTheme.missing.length ? ` (${perTheme.missing.map((m) => m.role).join(', ')})\n` : '\n');
    process.stdout.write(`   owner-accepted         ${perTheme.accepted.length} (listed above, never hidden)\n`);
    process.stdout.write(`   roles UNMEASURED       ${unknownRoles}`);
    process.stdout.write(
      unknownRoles
        ? ` (pass ${perTheme.unknown.map((u) => u.pass).join(', ')} could not be driven \u2014 gated, never assumed clean)\n`
        : '\n',
    );
    if (perTheme.structural.length) {
      process.stdout.write('   STRUCTURAL drift must be zero in both themes:\n');
      for (const r of perTheme.structural) {
        process.stdout.write(`     ${r.pass.padEnd(9)} ${r.role}.${r.prop}  ${r.detail}\n`);
      }
    }
    process.stdout.write(`   => ${gated === 0 && !perTheme.fatal ? 'PASS' : `FAIL (${gated} gating deviation(s))`}\n`);
    verdicts.push({ theme, gated, fatal: perTheme.fatal });
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  const bad = verdicts.filter((v) => v.gated > 0 || v.fatal);
  process.stdout.write(
    `\n${bad.length === 0 ? 'both themes hold the winner' : `drift in: ${bad.map((v) => v.theme).join(', ')}`}\n`,
  );
  return bad.length === 0 ? 0 : 1;
}

process.exit(main());
