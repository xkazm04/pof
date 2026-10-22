/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Does Unreal Engine work on THIS machine? (/diablo W109)
 *
 *   npx tsx scripts/diablo/ue_arm_probe.ts [--engine <UE root>] [--work <dir>] [--skip-build] [--json]
 *
 * Epic does not support the Unreal Editor on ARM64 (UE 5.8 Windows ARM64 docs: game targets only,
 * Experimental), so on this device the editor can only run as an emulated x64 process. That makes
 * "does it work" an empirical question, and this is the measurement — run on a BLANK C++ project
 * created from the engine's own template, so it needs no PoF project and can be run identically on
 * a second device to compare. The numbers it prints are the W109 pass criteria:
 *
 *   1. headless `-run=pythonscript -nullrhi` completes            → most of PoF's UE work is this
 *   2. a C++ editor target builds, and WHICH MSVC HOST built it   → the decisive one
 *   3. the editor initialises an RHI on the real GPU              → best-effort, editor-attached work
 *
 * Criterion 2 decides the device: `Hostarm64` means a native ARM64 compiler produced the x64
 * binaries and build times should be sane; an emulated `Hostx64` means the wall-clock below is the
 * number to judge, not the exit code. A missing engine is a REFUSAL, never a silent pass.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const has = (name: string) => process.argv.includes(`--${name}`);

const engine = resolve(arg('engine') ?? process.env.POF_UE_ENGINE ?? 'C:/Program Files/Epic Games/UE_5.8');
const work = resolve(arg('work') ?? join(homedir(), '.pof', 'ue-arm-probe'));
const cmdExe = join(engine, 'Engine/Binaries/Win64/UnrealEditor-Cmd.exe');
const buildBat = join(engine, 'Engine/Build/BatchFiles/Build.bat');

if (!existsSync(cmdExe)) {
  console.error(`REFUSED: no UnrealEditor-Cmd.exe at ${cmdExe}`);
  console.error('  Install UE (Epic Games Launcher, elevated) or pass --engine / set POF_UE_ENGINE.');
  process.exit(1);
}

/** Everything measured, so --json can hand the same numbers to a comparison against another device. */
const report: Record<string, unknown> = {
  at: new Date().toISOString(),
  engine,
  // Under Prism every x64 process reports itself x64, so node's own arch proves nothing about the
  // machine — PROCESSOR_IDENTIFIER is read from the real CPU and does.
  nodeArch: process.arch,
  cpu: process.env.PROCESSOR_IDENTIFIER ?? 'unknown',
  processorArchitecture: process.env.PROCESSOR_ARCHITECTURE ?? 'unknown',
  emulated: (process.env.PROCESSOR_IDENTIFIER ?? '').includes('ARM') && process.arch === 'x64',
};

const say = (line: string) => { if (!has('json')) console.log(line); };
const seconds = (ms: number) => Number((ms / 1000).toFixed(1));

// ── a blank C++ project, from the engine's own template ───────────────────────────────────────────
const templates = join(engine, 'Engine/Content/Editor/Templates');
const cppTemplate = ['TP_Blank', 'TP_BlankBP'].map((n) => join(engine, 'Engine/Templates', n)).find(existsSync);
if (!cppTemplate) {
  console.error(`REFUSED: no TP_Blank template under ${join(engine, 'Engine/Templates')} (looked for TP_Blank, TP_BlankBP)`);
  console.error(`  ${existsSync(templates) ? '' : 'Editor templates are missing too — is this a full editor install?'}`);
  process.exit(1);
}
const uprojectName = readdirSync(cppTemplate).find((n) => n.endsWith('.uproject'));
if (!uprojectName) { console.error(`REFUSED: template ${cppTemplate} has no .uproject`); process.exit(1); }
const projectName = uprojectName.replace(/\.uproject$/, '');

if (existsSync(work)) rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
cpSync(cppTemplate, work, { recursive: true });
// Templates ship a TemplateDefs.ini that only the project wizard reads; leaving it behind makes
// the copy look like a template rather than a project.
rmSync(join(work, 'Config/TemplateDefs.ini'), { force: true });
const uproject = join(work, uprojectName);
const isCpp = existsSync(join(work, 'Source'));
// Some engine templates carry wizard placeholders (%TEMPLATENAME%, PROJECT_NAME) that only the
// project wizard substitutes. Copying such a template gives a project that fails to compile for a
// reason that looks nothing like the ARM question this probe is asking, so say so up front.
const placeholders = (function scan(dir: string, hits: string[] = []): string[] {
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, n.name);
    if (n.isDirectory()) scan(p, hits);
    else if (/\.(h|cpp|cs|ini|uproject)$/i.test(n.name)) {
      const t = readFileSync(p, 'utf8');
      if (/%TEMPLATENAME%|%PROJECTNAME%|PROJECT_NAME_PLACEHOLDER/.test(t)) hits.push(p);
    }
  }
  return hits;
})(work);
if (placeholders.length) {
  say(`WARNING  ${placeholders.length} template file(s) still hold wizard placeholders — a build failure`);
  say(`         below is about the TEMPLATE, not about this device: ${placeholders[0]}`);
  report.templatePlaceholders = placeholders;
}
report.project = { path: uproject, fromTemplate: cppTemplate, hasCppSource: isCpp };
say(`project   ${uproject}\n          from ${cppTemplate} · C++ source: ${isCpp ? 'yes' : 'NO (blueprint-only template)'}`);

// ── criterion 2: does a C++ editor target build, and which MSVC host builds it ────────────────────
if (isCpp && !has('skip-build')) {
  const log = join(work, 'probe-build.log');
  const started = Date.now();
  const built = spawnSync('cmd.exe', ['/c', buildBat, `${projectName}Editor`, 'Win64', 'Development',
    `-Project=${uproject}`, '-WaitMutex', '-FromMsBuild'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const elapsed = Date.now() - started;
  const out = `${built.stdout ?? ''}\n${built.stderr ?? ''}`;
  writeFileSync(log, out);
  const hosts = [...new Set(out.match(/Host(?:arm64|x64|x86)/gi) ?? [])];
  const toolchain = out.split(/\r?\n/).filter((l) => /toolchain|Compiler:|WindowsSDK/i.test(l)).slice(0, 4);
  report.build = {
    ok: built.status === 0, exitCode: built.status, seconds: seconds(elapsed),
    msvcHosts: hosts, toolchainLines: toolchain, log,
  };
  say(`\ncriterion 2 — C++ editor target build: ${built.status === 0 ? 'PASS' : `FAIL (exit ${built.status})`} in ${seconds(elapsed)}s`);
  say(`          MSVC host(s) named in the log: ${hosts.length ? hosts.join(', ') : 'NONE — the host is not in the log, measure the wall-clock instead'}`);
  for (const l of toolchain) say(`          ${l.trim()}`);
  if (built.status !== 0) say(`          log: ${log}`);
} else {
  report.build = { skipped: true, reason: isCpp ? '--skip-build' : 'template has no C++ source' };
  say(`\ncriterion 2 — SKIPPED (${isCpp ? '--skip-build' : 'blueprint-only template: no C++ to build'})`);
}

// ── criterion 1: headless python ──────────────────────────────────────────────────────────────────
const py = join(work, 'probe.py');
writeFileSync(py, [
  'import unreal, sys',
  'print("POF_PROBE_OK version=%s" % unreal.SystemLibrary.get_engine_version())',
  'print("POF_PROBE_PLATFORM %s" % unreal.SystemLibrary.get_platform_user_name())',
  'sys.stdout.flush()',
].join('\n'));
{
  const started = Date.now();
  const run = spawnSync(cmdExe, [uproject, '-run=pythonscript', `-script=${py}`,
    '-nullrhi', '-unattended', '-nosplash', '-stdout', '-NoLogTimes'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const elapsed = Date.now() - started;
  const out = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const marker = /POF_PROBE_OK version=(.*)/.exec(out);
  const log = join(work, 'probe-python.log');
  writeFileSync(log, out);
  report.pythonscript = {
    ok: Boolean(marker) && run.status === 0, exitCode: run.status, seconds: seconds(elapsed),
    engineVersion: marker?.[1]?.trim(), log,
  };
  say(`\ncriterion 1 — headless pythonscript: ${marker && run.status === 0 ? 'PASS' : `FAIL (exit ${run.status})`} in ${seconds(elapsed)}s`);
  if (marker) say(`          engine reports ${marker[1].trim()}`);
  else say(`          no POF_PROBE_OK marker — log: ${log}`);
}

// ── criterion 3: does an RHI come up on the real GPU (best-effort) ────────────────────────────────
// -nullrhi is deliberately absent here; the editor is given a short leash and then killed, and the
// verdict is read off its own log. A timeout is NOT a failure of the RHI, only of this measurement.
{
  const started = Date.now();
  const run = spawnSync(cmdExe, [uproject, '-nosplash', '-unattended', '-stdout', '-NoLogTimes',
    '-ExecCmds=Quit'], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 240_000 });
  const elapsed = Date.now() - started;
  const out = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const log = join(work, 'probe-rhi.log');
  writeFileSync(log, out);
  const rhi = out.split(/\r?\n/).filter((l) => /D3D12|D3D11|Vulkan|GPU Adapter|Adapter Name|RHI/i.test(l)).slice(0, 6);
  report.rhi = { timedOut: run.error?.message?.includes('ETIMEDOUT') ?? false, exitCode: run.status, seconds: seconds(elapsed), lines: rhi, log };
  say(`\ncriterion 3 — RHI on the real GPU (best-effort): ${rhi.length ? 'lines found' : 'INCONCLUSIVE'} after ${seconds(elapsed)}s`);
  for (const l of rhi) say(`          ${l.trim()}`);
  if (!rhi.length) say(`          nothing RHI-shaped in the log: ${log}`);
}

if (has('json')) console.log(JSON.stringify(report, null, 2));
else {
  const b = report.build as { ok?: boolean; msvcHosts?: string[]; seconds?: number; skipped?: boolean };
  const p = report.pythonscript as { ok?: boolean };
  say('\n=== verdict ===');
  say(`  headless python   ${p.ok ? 'works' : 'does NOT work'}`);
  say(`  C++ editor build  ${b.skipped ? 'not measured' : b.ok ? `works in ${b.seconds}s` : 'does NOT build'}`);
  say(`  built by          ${b.msvcHosts?.length ? b.msvcHosts.join(', ') : 'unknown'}${b.msvcHosts?.includes('Hostarm64') ? ' — native ARM64 host, the good case' : ''}`);
  say('  Run this same command on the other device and compare, before deciding where UE lives.');
}
