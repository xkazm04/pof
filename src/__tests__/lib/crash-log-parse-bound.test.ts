import { describe, it, expect } from 'vitest';
import { parseCrashLog } from '@/lib/crash-analyzer/crash-log-parser';
import { analyzeSingleCrash } from '@/lib/crash-analyzer/analysis-engine';
import { CRASH_HISTORY_LIMITS } from '@/types/crash-analyzer';

const HEADER = [
  '[2026.02.14-22.00.00:001][  0]LogInit: CPU Brand: AMD Ryzen 9',
  '[2026.02.14-22.00.00:002][  0]LogInit: GPU Brand: NVIDIA RTX',
  '[2026.02.14-22.00.00:003][  0]LogInit: OS: Windows 11',
].join('\n');
const NOISE = '[2026.02.14-22.01.00:123][ 42]LogTemp: Log: ordinary editor chatter that is not a crash, line filler\n';
const CRASH = [
  '[2026.02.14-22.15.33:456][  0]LogWindows: Error: Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000000',
  '[2026.02.14-22.15.33:457][  0]LogWindows: Error: [Callstack]',
  '[2026.02.14-22.15.33:458][  0]LogWindows: Error: 0x00007ff6 MyGame!AMyChar::Tick() [D:/p/MyChar.cpp:42]',
  '[2026.02.14-22.15.33:459][  0]LogWindows: Error: 0x00007ff7 UnrealEditor-Engine!AActor::Tick() [D:/e/Actor.cpp:9]',
].join('\n');

function bigLog(mb: number): string {
  const n = Math.ceil((mb * 1024 * 1024) / NOISE.length);
  return `${HEADER}\n${NOISE.repeat(n)}${CRASH}\n`;
}

/** Characters of the raw text the parser had to look at. */
function parsedChars(mb: number): number {
  const report = parseCrashLog(bigLog(mb));
  expect(report).not.toBeNull();
  return report!.rawLog.length;
}

describe('parseCrashLog - parse window is bounded', () => {
  it('keeps the parse window within a fixed multiple of the stored bound at 1/10/50 MB', () => {
    const cap = CRASH_HISTORY_LIMITS.rawLogChars * 4;
    for (const mb of [1, 10, 50]) {
      expect(parsedChars(mb)).toBeLessThanOrEqual(cap);
    }
  });

  it('still finds the crash, its frames, the header machine state and the timestamp in a 10 MB log', () => {
    const report = parseCrashLog(bigLog(10))!;
    expect(report.crashType).toBe('nullptr_deref');
    expect(report.callstack.length).toBe(2);
    expect(report.machineState.cpuBrand).toBe('AMD Ryzen 9');
    expect(report.machineState.gpuBrand).toBe('NVIDIA RTX');
    expect(report.timestamp.length).toBeGreaterThan(0);
    expect(analyzeSingleCrash(report).report.callstack.length).toBe(2);
  });

  it('leaves a log under the window untouched', () => {
    const small = `${HEADER}\n${CRASH}\n`;
    expect(parseCrashLog(small)!.rawLog).toBe(small);
  });

  it('says so when it omitted text', () => {
    expect(parseCrashLog(bigLog(10))!.rawLog).toContain('omitted');
  });

});
