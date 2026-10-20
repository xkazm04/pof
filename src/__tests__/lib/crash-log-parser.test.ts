import { describe, it, expect } from 'vitest';
import { parseCrashLog } from '@/lib/crash-analyzer/crash-log-parser';
import { parseCrashLog as viaEngine } from '@/lib/crash-analyzer/analysis-engine';

const log = (msg: string, extra = '') =>
  `[2026.02.14-22.15.33:456][  0]LogWindows: Error: ${msg}\n${extra}`;

describe('parseCrashLog classification', () => {
  it('is re-exported by the analysis engine', () => {
    expect(viaEngine).toBe(parseCrashLog);
  });

  it('a non-null access violation is access_violation, not nullptr_deref', () => {
    const r = parseCrashLog(log('EXCEPTION_ACCESS_VIOLATION reading address 0x00007FF612340000'));
    expect(r?.crashType).toBe('access_violation');
  });

  it('a small-address access violation is a critical nullptr_deref', () => {
    const r = parseCrashLog(log('EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000008'));
    expect(r?.crashType).toBe('nullptr_deref');
    expect(r?.severity).toBe('critical');
  });

  it('reaches gpu_crash and out_of_memory', () => {
    expect(parseCrashLog(log('Out of video memory'))?.crashType).toBe('gpu_crash');
    expect(parseCrashLog(log('DXGI_ERROR_DEVICE_REMOVED'))?.crashType).toBe('gpu_crash');
    expect(parseCrashLog(log('Out of memory trying to allocate 4096 bytes'))?.crashType).toBe('out_of_memory');
  });

  it('keeps the existing classes and falls through to unknown', () => {
    expect(parseCrashLog(log('Assertion failed: X != nullptr'))?.crashType).toBe('assertion_failed');
    expect(parseCrashLog(log('Ensure condition failed: Y'))?.crashType).toBe('ensure_failed');
    expect(parseCrashLog(log('Fatal error: boom'))?.crashType).toBe('fatal_error');
    expect(parseCrashLog(log('something odd'))?.crashType).toBe('unknown');
  });

  it('returns null without an Error line', () => {
    expect(parseCrashLog('nothing here')).toBeNull();
  });
});

describe('parseCrashLog machine state', () => {
  it('reads CPU/GPU/OS/RAM from the header', () => {
    const text = [
      'LogInit: CPU Brand: AMD Ryzen 9 7950X',
      'LogInit: GPU Brand: NVIDIA RTX 4080',
      'LogInit: OS: Windows 11 (23H2)',
      'LogMemory: Memory: 32768',
      log('Assertion failed: x'),
    ].join('\n');
    const m = parseCrashLog(text)!.machineState;
    expect(m.cpuBrand).toBe('AMD Ryzen 9 7950X');
    expect(m.gpuBrand).toBe('NVIDIA RTX 4080');
    expect(m.osVersion).toBe('Windows 11 (23H2)');
    expect(m.ramMB).toBe(32768);
  });

  it('keeps the defaults when the header is absent', () => {
    const m = parseCrashLog(log('Assertion failed: x'))!.machineState;
    expect(m.cpuBrand).toBe('Unknown');
    expect(m.gpuBrand).toBe('Unknown');
    expect(m.osVersion).toBe('Unknown');
    expect(m.ramMB).toBe(0);
  });
});

describe('parseCrashLog determinism and frames', () => {
  const text = log('Assertion failed: x', [
    'LogWindows: Error: [Callstack]',
    'LogWindows: Error: UnrealEditor-Engine!FDebug::AssertFailed()',
    'LogWindows: Error: MyGame!AFoo::Bar() [Source/Foo.cpp:12]',
  ].join('\n'));

  it('same text gives same id', () => {
    expect(parseCrashLog(text)!.id).toBe(parseCrashLog(text)!.id);
    expect(parseCrashLog(text + ' ')!.id).not.toBe(parseCrashLog(text)!.id);
  });

  it('does not invent frame addresses', () => {
    const r = parseCrashLog(text)!;
    expect(r.callstack).toHaveLength(2);
    for (const f of r.callstack) expect(f.address).toBe('');
  });

  it('reads an address when the log carries one', () => {
    const t = log('Fatal error', 'LogWindows: Error: [Callstack]\nLogWindows: Error: 0x00007FF612340000 MyGame!AFoo::Bar()');
    expect(parseCrashLog(t)!.callstack[0].address).toBe('0x00007FF612340000');
  });
});
