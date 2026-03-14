import { describe, it, expect } from 'vitest';
import { matchCommands } from '../commands';
import type { SlashCommand } from '../types';

function makeCommand(name: string, description = ''): SlashCommand {
  return { name, description, execute: () => {} };
}

describe('matchCommands', () => {
  const commands: SlashCommand[] = [
    makeCommand('show', 'Show a panel'),
    makeCommand('compose', 'Compose workspace'),
    makeCommand('share', 'Share story'),
    makeCommand('clear', 'Clear chat'),
    makeCommand('help', 'Show help'),
  ];

  it('returns all commands when query is empty', () => {
    const result = matchCommands('', commands);
    expect(result).toHaveLength(5);
  });

  it('returns commands whose name starts with query', () => {
    const result = matchCommands('sh', commands);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name)).toEqual(
      expect.arrayContaining(['show', 'share'])
    );
  });

  it('returns empty array when no match', () => {
    const result = matchCommands('xyz', commands);
    expect(result).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const result = matchCommands('SH', commands);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name)).toEqual(
      expect.arrayContaining(['show', 'share'])
    );
  });

  it('strips leading slash from query', () => {
    const result = matchCommands('/co', commands);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('compose');
  });
});
