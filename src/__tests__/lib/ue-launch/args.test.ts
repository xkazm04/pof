import { describe, it, expect } from 'vitest';
import { buildLaunchArgs } from '@/lib/ue-launch/args';

const P = 'C:\\proj\\PoF.uproject';

describe('buildLaunchArgs', () => {
  it('builds a headless invocation by default (includes -nullrhi)', () => {
    expect(buildLaunchArgs({ uproject: P })).toEqual([
      P, '-unattended', '-nopause', '-nosplash', '-nullrhi', '-NoLiveCoding', '-log',
    ]);
  });

  it('adds map, -ExecCmds and -abslog when provided', () => {
    expect(buildLaunchArgs({ uproject: P, map: '/Game/Maps/X', execCmds: 'py foo()', abslog: 'C:\\out.log' })).toEqual([
      P, '/Game/Maps/X', '-ExecCmds=py foo()',
      '-unattended', '-nopause', '-nosplash', '-nullrhi', '-NoLiveCoding', '-log',
      '-abslog=C:\\out.log',
    ]);
  });

  it('omits -nullrhi and adds -game for a windowed game launch', () => {
    expect(buildLaunchArgs({ uproject: P, map: '/Game/Maps/X', game: true, headless: false })).toEqual([
      P, '/Game/Maps/X', '-game', '-unattended', '-nopause', '-nosplash', '-NoLiveCoding', '-log',
    ]);
  });

  it('appends extraArgs at the end', () => {
    expect(buildLaunchArgs({ uproject: P, extraArgs: ['-EnablePlugins=ModelContextProtocol'] })).toEqual([
      P, '-unattended', '-nopause', '-nosplash', '-nullrhi', '-NoLiveCoding', '-log',
      '-EnablePlugins=ModelContextProtocol',
    ]);
  });
});
