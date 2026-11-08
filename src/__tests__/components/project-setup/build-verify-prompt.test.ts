import { describe, it, expect } from 'vitest';
import { buildBuildVerifyPrompt } from '@/components/modules/project-setup/prompts';
import { toolRow } from '@/lib/project-setup/toolchain';

const identity = { projectName: 'PoF', projectPath: 'C:/p/PoF', ueVersion: '5.8.0' };

describe('buildBuildVerifyPrompt engine selection', () => {
  it('finds the wanted engine by version when its folder is not named UE_x.y', () => {
    const prompt = buildBuildVerifyPrompt({
      ...identity,
      engines: [
        { version: '5.9.0', path: 'C:/Epic/UE_5.9' },
        { version: '5.8.1', path: 'D:/Engines/Custom' },
      ],
    });
    expect(prompt).toContain('using engine at "D:/Engines/Custom"');
  });

  it('does not take UE 5.10 for a 5.1 project', () => {
    const prompt = buildBuildVerifyPrompt({
      ...identity,
      ueVersion: '5.1.0',
      engines: [
        { version: '5.10.0', path: 'C:/Epic/UE_5.10' },
        { version: '5.1.1', path: 'C:/Epic/UE_5.1' },
      ],
    });
    expect(prompt).toContain('using engine at "C:/Epic/UE_5.1"');
  });

  it('falls back to the first engine when no version matches', () => {
    const prompt = buildBuildVerifyPrompt({ ...identity, engines: [{ version: '5.7.0', path: 'C:/Epic/UE_5.7' }] });
    expect(prompt).toContain('using engine at "C:/Epic/UE_5.7"');
  });

  it('says so in the prompt when it falls back to a different engine', () => {
    const prompt = buildBuildVerifyPrompt({ ...identity, engines: [{ version: '5.7.0', path: 'C:/Epic/UE_5.7' }] });
    expect(prompt).toContain('ENGINE MISMATCH: No installed engine matches UE 5.8; this build uses UE 5.7.0 instead.');
  });

  it('adds no mismatch line when the engine matches', () => {
    const prompt = buildBuildVerifyPrompt({ ...identity, engines: [{ version: '5.8.1', path: 'C:/Epic/UE_5.8' }] });
    expect(prompt).not.toContain('ENGINE MISMATCH');
  });
});

describe('buildBuildVerifyPrompt .NET requirement', () => {
  it('takes the required runtime version from the TOOLCHAIN dotnet row', () => {
    const row = toolRow('dotnet');
    const original = row.version;
    expect(original).toBeTruthy();
    row.version = '9';
    try {
      const prompt = buildBuildVerifyPrompt({ ...identity, engines: [{ version: '5.8.0', path: 'C:/Epic/UE_5.8' }] });
      expect(prompt).toContain('If no .NET 9.x in either path');
      expect(prompt).toContain('look for 9.x in either path');
      expect(prompt).not.toContain('8.x');
    } finally {
      row.version = original;
    }
  });
});
