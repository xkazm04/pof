import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Import boundary enforcement for @dzin/core
// Ensures zero coupling to Studio Story domain code or runtime dependencies
// ---------------------------------------------------------------------------

/** Forbidden import patterns: Studio Story domain paths */
const FORBIDDEN_DOMAIN_IMPORTS = [
  /from\s+['"](?:@\/|\.\.\/)*src\/app\//,
  /from\s+['"](?:@\/|\.\.\/)*src\/workspace\//,
  /from\s+['"](?:@\/|\.\.\/)*src\/manifest\//,
  /from\s+['"](?:@\/|\.\.\/)*src\/agents\//,
  /from\s+['"]@\/app\//,
  /from\s+['"]@\/workspace\//,
  /from\s+['"]@\/manifest\//,
  /from\s+['"]@\/agents\//,
];

/** Forbidden import patterns: domain-specific runtime dependencies */
const FORBIDDEN_RUNTIME_DEPS = [
  /from\s+['"]zustand/,
  /from\s+['"]@supabase\//,
  /from\s+['"]@tanstack\/react-query/,
];

/**
 * Recursively collect all .ts and .tsx files under a directory,
 * excluding __tests__ directories.
 */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      results.push(...collectSourceFiles(fullPath));
    } else if (stat.isFile()) {
      const ext = extname(entry);
      if (ext === '.ts' || ext === '.tsx') {
        results.push(fullPath);
      }
    }
  }

  return results;
}

describe('Package boundary', () => {
  const srcDir = join(__dirname, '..');
  const sourceFiles = collectSourceFiles(srcDir);

  it('finds source files to scan', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it('no file imports from Studio Story domain code', () => {
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of FORBIDDEN_DOMAIN_IMPORTS) {
        const match = content.match(pattern);
        if (match) {
          violations.push(`${file}: matched ${pattern} -> "${match[0]}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('no file imports domain-specific runtime dependencies (zustand, supabase, react-query)', () => {
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of FORBIDDEN_RUNTIME_DEPS) {
        const match = content.match(pattern);
        if (match) {
          violations.push(`${file}: matched ${pattern} -> "${match[0]}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
