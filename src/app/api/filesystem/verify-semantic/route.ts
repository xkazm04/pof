/**
 * POST /api/filesystem/verify-semantic
 *
 * Reads one or more .h files from the UE5 project and runs semantic
 * verification against checklist expectations. Returns per-item status:
 * 'full', 'partial', 'stub', or 'missing'.
 */

import { NextRequest } from 'next/server';
import fsPromises from 'fs/promises';
import path from 'path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseHeader, checkExpectations, type SemanticResult } from '@/lib/cpp-semantic-parser';
import { getExpectationsForItem, type ChecklistExpectation } from '@/lib/checklist-expectations';

interface VerifyRequest {
  projectPath: string;
  /** Items to verify — each with itemId and optional specific file path */
  items: { itemId: string; filePath?: string }[];
}

interface ItemVerification {
  itemId: string;
  status: 'full' | 'partial' | 'stub' | 'missing' | 'no-expectations';
  completeness: number;
  details: SemanticResult[];
  missingMembers: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyRequest;
    if (!body.projectPath || !body.items?.length) {
      return apiError('projectPath and items[] required', 400);
    }

    const sourceDir = path.join(body.projectPath, 'Source');

    // Collect all .h files from Source/ for parsing
    const headerFiles = await collectHeaders(sourceDir);

    // Parse all headers once
    const parsedHeaders = await Promise.all(
      headerFiles.map(async (fp) => {
        const content = await fsPromises.readFile(fp, 'utf-8');
        return parseHeader(content, fp);
      }),
    );

    // Verify each item
    const results: ItemVerification[] = [];

    for (const { itemId } of body.items) {
      const expectations = getExpectationsForItem(itemId);
      if (!expectations) {
        results.push({
          itemId,
          status: 'no-expectations',
          completeness: 0,
          details: [],
          missingMembers: [],
        });
        continue;
      }

      const details: SemanticResult[] = [];
      const allMissing: string[] = [];

      // Check primary expectation across all parsed headers
      const primaryResult = findBestMatch(parsedHeaders, expectations.primary);
      details.push(primaryResult);
      allMissing.push(
        ...primaryResult.missingComponents,
        ...primaryResult.missingProperties,
        ...primaryResult.missingFunctions,
      );

      // Check secondary expectations
      for (const sec of expectations.secondary ?? []) {
        const secResult = findBestMatch(parsedHeaders, sec);
        details.push(secResult);
        if (secResult.status !== 'full') {
          allMissing.push(
            ...secResult.missingComponents,
            ...secResult.missingProperties,
            ...secResult.missingFunctions,
          );
        }
      }

      // Aggregate status
      const avgCompleteness = details.reduce((s, d) => s + d.completeness, 0) / details.length;
      let status: ItemVerification['status'];
      if (details.every((d) => d.status === 'full')) {
        status = 'full';
      } else if (details.some((d) => d.status === 'missing')) {
        // Primary class missing → item is missing
        if (primaryResult.status === 'missing') {
          status = 'missing';
        } else {
          status = 'partial';
        }
      } else if (details.some((d) => d.status === 'stub')) {
        status = 'stub';
      } else {
        status = 'partial';
      }

      results.push({
        itemId,
        status,
        completeness: Math.round(avgCompleteness * 100) / 100,
        details,
        missingMembers: [...new Set(allMissing)],
      });
    }

    return apiSuccess({ results });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : 'Semantic verification failed',
      500,
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

import { type SemanticExpectation, type HeaderParseResult } from '@/lib/cpp-semantic-parser';

function findBestMatch(
  parsedHeaders: HeaderParseResult[],
  expectation: SemanticExpectation,
): SemanticResult {
  let bestResult: SemanticResult | null = null;

  for (const parsed of parsedHeaders) {
    const result = checkExpectations(parsed, expectation);
    if (result.found) {
      if (!bestResult || result.completeness > bestResult.completeness) {
        bestResult = result;
      }
    }
  }

  return bestResult ?? {
    className: expectation.className,
    found: false,
    completeness: 0,
    missingComponents: expectation.expectedComponents ?? [],
    missingProperties: expectation.expectedProperties ?? [],
    missingFunctions: expectation.expectedFunctions ?? [],
    isStub: false,
    status: 'missing',
  };
}

async function collectHeaders(sourceDir: string, maxDepth = 6): Promise<string[]> {
  const headers: string[] = [];

  try {
    await fsPromises.access(sourceDir);
  } catch {
    return headers;
  }

  async function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (entry.name === 'ThirdParty' || entry.name === 'Intermediate' || entry.name === 'Binaries') continue;
          await walk(fullPath, depth + 1);
        } else if (entry.name.endsWith('.h')) {
          headers.push(fullPath);
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  await walk(sourceDir, 0);
  return headers;
}
