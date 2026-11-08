import { describe, it, expect } from 'vitest';
import { buildBuildVerifyPrompt } from '@/components/modules/project-setup/prompts';

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
});
