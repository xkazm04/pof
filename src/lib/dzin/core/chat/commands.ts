import type { SlashCommand } from './types';

// ---------------------------------------------------------------------------
// Slash Command Matching
// ---------------------------------------------------------------------------

/**
 * Filters registered slash commands by a typed prefix.
 * Returns all commands when query is empty.
 * Case-insensitive; strips leading '/' from query.
 */
export function matchCommands(
  query: string,
  commands: SlashCommand[]
): SlashCommand[] {
  // Strip leading slash if present
  const normalized = query.replace(/^\//, '').toLowerCase();

  if (normalized === '') {
    return commands;
  }

  return commands.filter((cmd) =>
    cmd.name.toLowerCase().startsWith(normalized)
  );
}
