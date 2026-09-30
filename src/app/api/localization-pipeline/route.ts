import path from 'path';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { DEFAULT_CONFIG, SUPPORTED_LOCALES } from '@/lib/localization/definitions';
import { scanFromUnits, fixtureUnits, generateLOCTEXTReplacements, generateStringTable, isTranslatable } from '@/lib/localization/scan-engine';
import { readProjectUnits } from '@/lib/localization/project-source';
import { translateBatch, computeTranslationProgress } from '@/lib/localization/translation-engine';
import { validateTranslations } from '@/lib/localization/qa-engine';
import { ok, err, type Result } from '@/types/result';
import type { LocalizationConfig, ScanProvenance, ScanResult } from '@/types/localization-pipeline';

/* ---- GET: defaults ----------------------------------------------- */

export async function GET() {
  try {
    return apiSuccess({
      config: DEFAULT_CONFIG,
      supportedLocales: SUPPORTED_LOCALES,
    });
  } catch (err) {
    return apiError(`Failed to load defaults: ${err instanceof Error ? err.message : err}`, 500);
  }
}

/* ---- Scan source: the project's Source/, or the labelled demo corpus */

interface ResolvedScan {
  scan: ScanResult;
  provenance: ScanProvenance;
}

/**
 * The one place every action gets its strings. With a projectPath the scan reads
 * `<projectPath>/Source` read-only and a missing Source/ is an error — never a silent
 * fall back to the demo corpus. Without one, the demo corpus answers, labelled 'fixture'.
 */
async function resolveScan(body: Record<string, unknown>, config: LocalizationConfig): Promise<Result<ResolvedScan, string>> {
  const projectPath = body.projectPath;
  if (projectPath === undefined || projectPath === null || projectPath === '') {
    const scan = scanFromUnits(fixtureUnits(), config.scanModules);
    return ok({
      scan,
      provenance: { kind: 'fixture', root: null, filesScanned: scan.totalFilesScanned, literalsSeen: scan.totalStringsFound, excluded: {}, truncated: false },
    });
  }
  if (typeof projectPath !== 'string' || !path.isAbsolute(projectPath)) {
    return err('projectPath must be an absolute path to a UE project (the folder holding Source/)');
  }
  const read = await readProjectUnits(projectPath);
  if (!read.ok) return read;
  const scan = scanFromUnits(read.data.units, config.scanModules);
  return ok({ scan: { ...scan, totalFilesScanned: read.data.provenance.filesScanned }, provenance: read.data.provenance });
}

/* ---- POST: actions ----------------------------------------------- */

const ACTIONS = new Set(['scan', 'replacements', 'string-tables', 'translate', 'validate', 'full-pipeline']);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action as string;
    if (!ACTIONS.has(action)) return apiError('Unknown action', 400);

    const config = (body.config as LocalizationConfig) ?? DEFAULT_CONFIG;
    const resolved = await resolveScan(body, config);
    if (!resolved.ok) return apiError(resolved.error, 400);
    const { scan, provenance } = resolved.data;

    /* -- Scan for localizable strings -------------------------------- */
    if (action === 'scan') {
      return apiSuccess({ ...scan, provenance });
    }

    /* -- Generate LOCTEXT replacements ------------------------------- */
    if (action === 'replacements') {
      const replacements = generateLOCTEXTReplacements(scan.strings, config.rootNamespace);
      return apiSuccess({ replacements, totalStrings: scan.strings.length, provenance });
    }

    /* -- Generate String Tables -------------------------------------- */
    if (action === 'string-tables') {
      const tables = generateStringTable(scan.strings, config.rootNamespace);
      return apiSuccess({ tables, provenance });
    }

    // Compute the translatable subset ONCE and reuse it across every remaining stage.
    const translatable = scan.strings.filter(isTranslatable);
    const translation = translateBatch(translatable, config.targetLocales, config.glossary, undefined, config.autoApplyThreshold);
    const qa = validateTranslations(translation.entries, translatable, config.glossary, config.targetLocales);

    /* -- Translate --------------------------------------------------- */
    if (action === 'translate') {
      const progress = computeTranslationProgress(translation.entries, translatable.length, config.targetLocales);
      return apiSuccess({ translation, progress, qa, provenance });
    }

    /* -- Validate translated output (QA pass) ------------------------ */
    if (action === 'validate') {
      return apiSuccess({ qa, provenance });
    }

    /* -- Full pipeline (scan + translate + replacements) ------------- */
    const replacements = generateLOCTEXTReplacements(translatable, config.rootNamespace);
    const tables = generateStringTable(scan.strings, config.rootNamespace);
    const progress = computeTranslationProgress(translation.entries, translatable.length, config.targetLocales);
    return apiSuccess({
      scan,
      provenance,
      replacements,
      tables,
      translation,
      progress,
      qa,
    });
  } catch (err) {
    return apiError(`Localization pipeline error: ${err instanceof Error ? err.message : err}`, 500);
  }
}
