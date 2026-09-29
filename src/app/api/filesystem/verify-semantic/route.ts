/**
 * POST /api/filesystem/verify-semantic
 *
 * Reads one or more .h files from the UE5 project and runs semantic
 * verification against checklist expectations. Returns per-item status:
 * 'full', 'partial', 'stub', or 'missing'.
 *
 * Items are `{ moduleId, itemId }` — checked against that module's own expectations
 * (`getExpectationsFor`; ids repeat across modules) and echoed back with the moduleId.
 * A bare `{ itemId }` still resolves by id alone (legacy). Headers are read one by one:
 * an unreadable header is skipped and disclosed in `unreadable[]` (path relative to
 * Source/), never scored and never a 500. Read-only: nothing under the project is written.
 */

import { NextRequest } from 'next/server';
import fsPromises from 'fs/promises';
import path from 'path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseHeader, checkExpectations, type SemanticResult } from '@/lib/cpp-semantic-parser';
import { getExpectationsFor, getExpectationsForItem } from '@/lib/checklist-expectations';
import { collectHeaders } from '@/lib/ue-source/collect-headers';

interface VerifyRequest {
  projectPath: string;
  /** Items to verify — module-scoped { moduleId, itemId }; bare { itemId } is legacy */
  items: { moduleId?: string; itemId: string; filePath?: string }[];
}

interface ItemVerification {
  /** Echoed when the request named it */
  moduleId?: string;
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

    // Parse all headers once; an unreadable header is disclosed, not fatal
    const unreadable: string[] = [];
    const parsedOrNull = await Promise.all(
      headerFiles.map(async (fp): Promise<HeaderParseResult | null> => {
        try {
          const content = await fsPromises.readFile(fp, 'utf-8');
          return parseHeader(content, fp);
        } catch {
          unreadable.push(path.relative(sourceDir, fp).split(path.sep).join('/'));
          return null;
        }
      }),
    );
    const parsedHeaders = parsedOrNull.filter((p): p is HeaderParseResult => p !== null);
    unreadable.sort();

    // Verify each item
    const results: ItemVerification[] = [];

    for (const { moduleId, itemId } of body.items) {
      const expectations = moduleId
        ? getExpectationsFor(moduleId, itemId)
        : getExpectationsForItem(itemId);
      const echo = moduleId ? { moduleId } : {};
      if (!expectations) {
        results.push({
          ...echo,
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
        ...echo,
        itemId,
        status,
        completeness: Math.round(avgCompleteness * 100) / 100,
        details,
        missingMembers: [...new Set(allMissing)],
      });
    }

    return apiSuccess({ results, unreadable });
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
